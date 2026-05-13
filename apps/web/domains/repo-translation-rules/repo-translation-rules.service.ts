import { parse as parseYaml } from "yaml"

import { installationClient } from "@workspace/github"
import {
  configSchema,
  ICU_FLOW_CONFIG_PATH,
  type IcuFlowConfig,
} from "@workspace/translation-config"

import * as installationRepo from "@/domains/installations/installation.repository"
import * as repoRepo from "@/domains/installations/repo.repository"
import { getQueue } from "@/lib/queue"

import * as rulesRepo from "./repo-translation-rules.repository"
import type { RulesView } from "./repo-translation-rules.repository"

export type { RulesView } from "./repo-translation-rules.repository"

export interface AuthorizedRepo {
  id: string
  owner: string
  name: string
  defaultBranch: string
  githubInstallationId: number
}

export interface RulesPageData {
  repo: AuthorizedRepo
  rules: RulesView
  config: IcuFlowConfig | null
  configError: string | null
}

/** Returns the repo only if the user owns the installation it belongs to. */
export async function authorizeRepoForUser(
  repoId: string,
  userId: string,
): Promise<AuthorizedRepo | null> {
  const repo = await repoRepo.findById(repoId)
  if (!repo) return null
  const installation = await installationRepo.findByConnectedUser(userId)
  const match = installation.find((row) => row.id === repo.installationId)
  if (!match) return null
  return {
    id: repo.id,
    owner: repo.owner,
    name: repo.name,
    defaultBranch: repo.defaultBranch,
    githubInstallationId: match.githubInstallationId,
  }
}

/** Pull icu-flow.yml from the repo's default branch and validate it. */
export async function fetchIcuFlowConfig(
  repo: AuthorizedRepo,
): Promise<{ config: IcuFlowConfig | null; error: string | null }> {
  try {
    const octokit = await installationClient(repo.githubInstallationId)
    const { data } = await octokit.rest.repos.getContent({
      owner: repo.owner,
      repo: repo.name,
      path: ICU_FLOW_CONFIG_PATH,
      ref: repo.defaultBranch,
    })
    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      return { config: null, error: `${ICU_FLOW_CONFIG_PATH} is not a file` }
    }
    const raw = Buffer.from(data.content, data.encoding as BufferEncoding).toString(
      "utf8",
    )
    const parsed = parseYaml(raw) as unknown
    const result = configSchema.safeParse(parsed)
    if (!result.success) {
      return {
        config: null,
        error: `${ICU_FLOW_CONFIG_PATH} is invalid: ${result.error.issues
          .map((i) => i.message)
          .join("; ")}`,
      }
    }
    return { config: result.data, error: null }
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 404) {
      return {
        config: null,
        error: `No \`${ICU_FLOW_CONFIG_PATH}\` on \`${repo.defaultBranch}\` yet — add one to enable per-language rules.`,
      }
    }
    const message = error instanceof Error ? error.message : String(error)
    return { config: null, error: `Failed to load config: ${message}` }
  }
}

export async function loadRulesPage(
  repoId: string,
  userId: string,
): Promise<RulesPageData | null> {
  const repo = await authorizeRepoForUser(repoId, userId)
  if (!repo) return null
  const [rules, configResult] = await Promise.all([
    rulesRepo.findByRepoId(repo.id),
    fetchIcuFlowConfig(repo),
  ])
  return {
    repo,
    rules,
    config: configResult.config,
    configError: configResult.error,
  }
}

export async function enqueueEnforce(
  repoId: string,
  userId: string,
  locales: string[],
): Promise<{ ok: boolean; error?: string }> {
  if (locales.length === 0) return { ok: false, error: "no locales" }
  const repo = await authorizeRepoForUser(repoId, userId)
  if (!repo) return { ok: false, error: "not found" }

  let sha: string
  try {
    const octokit = await installationClient(repo.githubInstallationId)
    const { data } = await octokit.rest.repos.getBranch({
      owner: repo.owner,
      repo: repo.name,
      branch: repo.defaultBranch,
    })
    sha = data.commit.sha
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: `Failed to resolve branch head: ${message}` }
  }

  const queue = await getQueue()
  await queue.enqueue("translate-repo", {
    installationId: repo.githubInstallationId,
    repoFullName: `${repo.owner}/${repo.name}`,
    sha,
    reason: "manual",
    enforceLocales: locales,
  })
  return { ok: true }
}

export async function saveRules(
  repoId: string,
  userId: string,
  input: RulesView,
): Promise<{ ok: boolean; error?: string }> {
  const repo = await authorizeRepoForUser(repoId, userId)
  if (!repo) return { ok: false, error: "not found" }

  const existing = await rulesRepo.findByRepoId(repo.id)

  // Merge: keep any locale rules from the DB that weren't submitted (e.g. a
  // locale temporarily removed from icu-flow.yml). The form posts the full
  // set it knows about, so submitted keys win.
  const merged: Record<string, string> = { ...existing.languageRules }
  for (const [locale, value] of Object.entries(input.languageRules)) {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      delete merged[locale]
    } else {
      merged[locale] = value
    }
  }

  await rulesRepo.upsert(repo.id, {
    generalRules: input.generalRules,
    languageRules: merged,
  })
  return { ok: true }
}
