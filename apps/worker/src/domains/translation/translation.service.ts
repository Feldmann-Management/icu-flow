import path from "node:path"

import type { JobPayload } from "@workspace/queue"

import {
  applyTranslations,
  buildTargetFromSource,
  readCatalog,
  writeCatalog,
} from "./catalog.service"
import { readConfig, resolveLocalePath } from "./config.service"
import {
  cloneRepo,
  commitAndForcePushTranslations,
  TRANSLATION_BRANCH,
} from "./git.service"
import { resolveLlmConfig, translateBatch } from "./llm.service"
import { openOrUpdatePullRequest } from "./pr.service"
import * as repoRepo from "./repo.repository"
import * as translationPrRepo from "./translation-pr.repository"
import * as translationRunRepo from "./translation-run.repository"
import { createWorkdir, removeWorkdir } from "./workdir.service"

export async function runTranslation(
  payload: JobPayload<"translate-repo">,
  jobId: string,
): Promise<void> {
  const [owner, name] = payload.repoFullName.split("/", 2) as [string, string]
  const repoRow = await repoRepo.findByOwnerAndName(owner, name)

  if (!repoRow) {
    console.warn(
      `[translate-repo] repo row missing for ${payload.repoFullName}; dropping job`,
    )
    return
  }

  const run = await translationRunRepo.create({
    repoId: repoRow.id,
    triggerSha: payload.sha,
    triggerReason: payload.reason,
  })

  const llmConfig = await resolveLlmConfig()
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

        const translations = await translateBatch(llmConfig, {
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
      await translationRunRepo.markSucceeded({
        id: run.id,
        keysTranslated: 0,
        localesTouched: [],
        prId: null,
      })
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

    const prRow = await translationPrRepo.upsert({
      repoId: repoRow.id,
      githubPrNumber: prResult.number,
      branchName: TRANSLATION_BRANCH,
      headSha: prResult.headSha,
    })

    await translationRunRepo.markSucceeded({
      id: run.id,
      keysTranslated,
      localesTouched: [...localesTouched],
      prId: prRow.id,
    })

    await repoRepo.setLastProcessedSha(repoRow.id, payload.sha)

    success = true
    console.log(
      `[translate-repo] ${payload.repoFullName}: PR #${prResult.number} ${prResult.action} (${keysTranslated} keys)`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[translate-repo] ${payload.repoFullName} failed:`, error)
    await translationRunRepo.markFailed(run.id, message)
    throw error
  } finally {
    await removeWorkdir(workdir)
    if (!success) {
      console.warn(
        `[translate-repo] cleanup only — run ${run.id} did not succeed`,
      )
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
