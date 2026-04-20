import { fetchInstallation, fetchInstallationRepos } from "@workspace/github"

import * as installationRepo from "./installation.repository"
import * as repoRepo from "./repo.repository"

export interface InstallationView {
  id: string
  githubInstallationId: number
  accountType: string
  accountLogin: string
  suspendedAt: Date | null
  repos: {
    id: string
    owner: string
    name: string
    defaultBranch: string
  }[]
}

/** Called from the install callback route — syncs the full installation + repos snapshot. */
export async function syncFromGitHub(
  installationId: number,
  userId: string,
): Promise<void> {
  const metadata = await fetchInstallation(installationId)
  const repos = await fetchInstallationRepos(installationId)

  const row = await installationRepo.upsert({
    githubInstallationId: metadata.id,
    accountType: metadata.accountType,
    accountLogin: metadata.accountLogin,
    accountId: metadata.accountId,
    connectedByUserId: userId,
    suspendedAt: metadata.suspendedAt ? new Date(metadata.suspendedAt) : null,
  })

  // Repo upsert is idempotent; if it fails, a subsequent install callback or
  // `installation_repositories` webhook will retry it.
  await repoRepo.upsertMany(
    repos.map((r) => ({
      installationId: row.id,
      githubRepoId: r.githubRepoId,
      owner: r.owner,
      name: r.name,
      defaultBranch: r.defaultBranch,
    })),
  )
}

export async function listForUser(userId: string): Promise<InstallationView[]> {
  const installations = await installationRepo.findByConnectedUser(userId)
  const installationIds = installations.map((row) => row.id)
  const repos = await repoRepo.findByInstallationIds(installationIds)

  const reposByInstallation = new Map<string, typeof repos>()
  for (const r of repos) {
    const list = reposByInstallation.get(r.installationId) ?? []
    list.push(r)
    reposByInstallation.set(r.installationId, list)
  }

  return installations.map((inst) => ({
    id: inst.id,
    githubInstallationId: inst.githubInstallationId,
    accountType: inst.accountType,
    accountLogin: inst.accountLogin,
    suspendedAt: inst.suspendedAt,
    repos: (reposByInstallation.get(inst.id) ?? []).map((r) => ({
      id: r.id,
      owner: r.owner,
      name: r.name,
      defaultBranch: r.defaultBranch,
    })),
  }))
}

interface WebhookRepo {
  id: number
  name: string
  full_name: string
  default_branch?: string
}

export async function applyInstallationEvent(
  action: string,
  githubInstallationId: number,
  repositories: WebhookRepo[] | undefined,
): Promise<void> {
  const row = await installationRepo.findByGithubId(githubInstallationId)

  switch (action) {
    case "created":
    case "new_permissions_accepted":
      if (row && repositories?.length) {
        await upsertRepos(row.id, repositories)
      }
      break
    case "deleted":
      if (row) await installationRepo.deleteById(row.id)
      break
    case "suspend":
      if (row) await installationRepo.setSuspended(row.id, new Date())
      break
    case "unsuspend":
      if (row) await installationRepo.setSuspended(row.id, null)
      break
    default:
      break
  }
}

export async function applyRepositoriesEvent(
  githubInstallationId: number,
  added: WebhookRepo[],
  removed: WebhookRepo[],
): Promise<void> {
  const row = await installationRepo.findByGithubId(githubInstallationId)
  if (!row) return

  if (added.length > 0) await upsertRepos(row.id, added)
  for (const r of removed) await repoRepo.deleteByGithubRepoId(r.id)
}

async function upsertRepos(
  internalInstallationId: string,
  repos: WebhookRepo[],
): Promise<void> {
  // default_branch is not always on the webhook payload; fall back to "main".
  // The worker re-reads the default branch from the API on each run anyway.
  await repoRepo.upsertMany(
    repos.map((r) => ({
      installationId: internalInstallationId,
      githubRepoId: r.id,
      owner: r.full_name.split("/")[0] ?? "",
      name: r.name,
      defaultBranch: r.default_branch ?? "main",
    })),
  )
}

export async function findActiveRepoByGithubId(
  githubRepoId: number,
): Promise<{ id: string; active: boolean } | undefined> {
  const row = await repoRepo.findByGithubRepoId(githubRepoId)
  if (!row) return undefined
  return { id: row.id, active: row.active }
}
