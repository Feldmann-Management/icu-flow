import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "octokit"

import { appConfig, db } from "@workspace/db"

/** Anonymous Octokit client — used once during the manifest conversion flow. */
export function anonClient(): Octokit {
  return new Octokit()
}

/**
 * Update the App's webhook URL to match the given base URL. Used on boot so
 * tunnel URL rotations don't break push delivery.
 */
export async function syncWebhookUrl(baseUrl: string): Promise<void> {
  const creds = await getAppCredentials()
  const auth = createAppAuth({
    appId: creds.githubAppId,
    privateKey: creds.githubAppPrivateKey,
  })
  const { token } = await auth({ type: "app" })
  const url = `${baseUrl.replace(/\/$/, "")}/api/webhooks/github`
  const response = await fetch("https://api.github.com/app/hook/config", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, content_type: "json" }),
  })
  if (!response.ok) {
    throw new Error(
      `GitHub PATCH /app/hook/config failed: ${response.status} ${await response.text()}`,
    )
  }
}

export class AppNotConfiguredError extends Error {
  constructor() {
    super("No GitHub App has been configured yet — run /setup first.")
    this.name = "AppNotConfiguredError"
  }
}

export type AppCredentials = typeof appConfig.$inferSelect

export async function getAppCredentials(): Promise<AppCredentials> {
  const rows = await db.select().from(appConfig).limit(1)
  const row = rows[0]
  if (!row) {
    throw new AppNotConfiguredError()
  }
  return row
}

export async function hasAppCredentials(): Promise<boolean> {
  const rows = await db.select({ id: appConfig.id }).from(appConfig).limit(1)
  return rows.length > 0
}

export async function appClient(): Promise<Octokit> {
  const creds = await getAppCredentials()
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: creds.githubAppId,
      privateKey: creds.githubAppPrivateKey,
    },
  })
}

export async function installationClient(installationId: number): Promise<Octokit> {
  const creds = await getAppCredentials()
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: creds.githubAppId,
      privateKey: creds.githubAppPrivateKey,
      installationId,
    },
  })
}

/** Mint an installation access token for git HTTPS auth. */
export async function getInstallationToken(installationId: number): Promise<string> {
  const creds = await getAppCredentials()
  const auth = createAppAuth({
    appId: creds.githubAppId,
    privateKey: creds.githubAppPrivateKey,
  })
  const { token } = await auth({ type: "installation", installationId })
  return token
}

/** GitHub identity for commits authored by our bot. */
export function botCommitIdentity(creds: AppCredentials): { name: string; email: string } {
  return {
    name: `${creds.githubAppSlug}[bot]`,
    email: `${creds.githubAppId}+${creds.githubAppSlug}[bot]@users.noreply.github.com`,
  }
}

export interface InstallationMetadata {
  id: number
  accountType: "User" | "Organization"
  accountLogin: string
  accountId: number
  suspendedAt: string | null
}

export async function fetchInstallation(
  installationId: number,
): Promise<InstallationMetadata> {
  const client = await appClient()
  const { data } = await client.request(
    "GET /app/installations/{installation_id}",
    { installation_id: installationId },
  )
  const account = data.account
  if (!account || !("login" in account)) {
    throw new Error("Installation has no account")
  }
  const accountType = data.target_type === "Organization" ? "Organization" : "User"
  return {
    id: data.id,
    accountType,
    accountLogin: account.login,
    accountId: account.id,
    suspendedAt: data.suspended_at ?? null,
  }
}

export interface RepoMetadata {
  githubRepoId: number
  owner: string
  name: string
  defaultBranch: string
}

export async function fetchInstallationRepos(
  installationId: number,
): Promise<RepoMetadata[]> {
  const octokit = await installationClient(installationId)
  const repos = await octokit.paginate(
    "GET /installation/repositories",
    { per_page: 100 },
    (response) => response.data,
  )
  return repos.map((repo) => ({
    githubRepoId: repo.id,
    owner: repo.owner.login,
    name: repo.name,
    defaultBranch: repo.default_branch,
  }))
}
