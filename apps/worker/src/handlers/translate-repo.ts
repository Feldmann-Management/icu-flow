import path from "node:path"

import {
  and,
  db,
  eq,
  repo as repoTable,
  translationPr,
  translationRun,
} from "@workspace/db"
import type { JobPayload } from "@workspace/queue"

import { readConfig, resolveLocalePath } from "../lib/config"
import { cloneRepo, commitAndForcePushTranslations } from "../lib/git"
import { translateBatch } from "../lib/openai"
import {
  applyTranslations,
  buildTargetFromSource,
  readCatalog,
  writeCatalog,
} from "../lib/po"
import { openOrUpdatePullRequest } from "../lib/pr"
import { createWorkdir, removeWorkdir } from "../lib/workdir"

export async function translateRepo(
  payload: JobPayload<"translate-repo">,
  jobId: string,
): Promise<void> {
  const [owner, name] = payload.repoFullName.split("/", 2) as [string, string]
  const [repoRow] = await db
    .select()
    .from(repoTable)
    .where(and(eq(repoTable.owner, owner), eq(repoTable.name, name)))
    .limit(1)

  if (!repoRow) {
    console.warn(
      `[translate-repo] repo row missing for ${payload.repoFullName}; dropping job`,
    )
    return
  }

  const [run] = await db
    .insert(translationRun)
    .values({
      repoId: repoRow.id,
      triggerSha: payload.sha,
      triggerReason: payload.reason,
      status: "running",
      startedAt: new Date(),
    })
    .returning()
  if (!run) throw new Error("failed to create translation_run row")

  const workdir = await createWorkdir(jobId)
  let success = false
  try {
    const git = await cloneRepo({
      workdir,
      installationId: payload.installationId,
      owner: repoRow.owner,
      name: repoRow.name,
      defaultBranch: repoRow.defaultBranch,
    })

    const config = await readConfig(workdir)
    const localesTouched = new Set<string>()
    let keysTranslated = 0

    for (const template of config.messages) {
      const sourcePath = path.join(
        workdir,
        resolveLocalePath(template, config.source),
      )
      const sourceCatalog = await readCatalog(sourcePath)
      if (!sourceCatalog) {
        console.warn(
          `[translate-repo] source catalog missing at ${sourcePath}; skipping`,
        )
        continue
      }

      for (const targetLocale of config.targets) {
        if (targetLocale === config.source) continue
        const targetPath = path.join(
          workdir,
          resolveLocalePath(template, targetLocale),
        )
        const existing = await readCatalog(targetPath)
        const { catalog, missing } = buildTargetFromSource(
          sourceCatalog,
          existing,
          targetLocale,
        )

        if (missing.length === 0) {
          if (!existing) {
            await writeCatalog(targetPath, catalog)
            localesTouched.add(targetLocale)
          }
          continue
        }

        const translations = await translateBatch({
          sourceLocale: config.source,
          targetLocale,
          entries: missing.map((m) => ({
            key: `${m.context}\u0000${m.msgid}`,
            source: m.source,
          })),
        })

        const applied = translations.map((t) => {
          const [context, msgid] = t.key.split("\u0000", 2) as [string, string]
          return { context, msgid, translation: t.translation }
        })
        applyTranslations(catalog, applied)

        await writeCatalog(targetPath, catalog)
        keysTranslated += applied.length
        localesTouched.add(targetLocale)
      }
    }

    const commitResult = await commitAndForcePushTranslations(
      git,
      `chore(i18n): translate ${keysTranslated} messages into ${[...localesTouched].join(", ") || "none"}`,
    )

    if (!commitResult) {
      await db
        .update(translationRun)
        .set({
          status: "succeeded",
          finishedAt: new Date(),
          keysTranslated: 0,
          localesTouched: [],
        })
        .where(eq(translationRun.id, run.id))
      success = true
      console.log(`[translate-repo] ${payload.repoFullName}: no changes`)
      return
    }

    const prResult = await openOrUpdatePullRequest({
      installationId: payload.installationId,
      owner: repoRow.owner,
      name: repoRow.name,
      defaultBranch: repoRow.defaultBranch,
      title: "Translate missing messages",
      body: renderPrBody(keysTranslated, [...localesTouched]),
    })

    const [prRow] = await db
      .insert(translationPr)
      .values({
        repoId: repoRow.id,
        githubPrNumber: prResult.number,
        branchName: "icu-flow/translations",
        headSha: prResult.headSha,
        status: "open",
      })
      .onConflictDoUpdate({
        target: [translationPr.repoId, translationPr.githubPrNumber],
        set: {
          headSha: prResult.headSha,
          status: "open",
          updatedAt: new Date(),
        },
      })
      .returning()

    await db
      .update(translationRun)
      .set({
        status: "succeeded",
        finishedAt: new Date(),
        keysTranslated,
        localesTouched: [...localesTouched],
        prId: prRow?.id ?? null,
      })
      .where(eq(translationRun.id, run.id))

    await db
      .update(repoTable)
      .set({ lastProcessedSha: payload.sha, updatedAt: new Date() })
      .where(eq(repoTable.id, repoRow.id))

    success = true
    console.log(
      `[translate-repo] ${payload.repoFullName}: PR #${prResult.number} ${prResult.action} (${keysTranslated} keys)`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[translate-repo] ${payload.repoFullName} failed:`, error)
    await db
      .update(translationRun)
      .set({ status: "failed", finishedAt: new Date(), error: message })
      .where(eq(translationRun.id, run.id))
    throw error
  } finally {
    await removeWorkdir(workdir)
    if (!success) {
      console.warn(`[translate-repo] cleanup only — run ${run.id} did not succeed`)
    }
  }
}

function renderPrBody(count: number, locales: string[]): string {
  return [
    `Automated translation update by ICU Flow.`,
    "",
    `- **Keys translated:** ${count}`,
    `- **Locales touched:** ${locales.join(", ") || "none"}`,
    "",
    `This PR force-updates whenever \`main\` advances and new messages are added.`,
  ].join("\n")
}

