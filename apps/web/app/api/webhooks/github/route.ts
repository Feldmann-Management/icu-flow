import crypto from "node:crypto"

import { NextResponse } from "next/server"

import { db, eq, installation, repo, sql } from "@workspace/db"

import { getAppCredentials } from "@/lib/github"
import { getQueue } from "@/lib/queue"

export const dynamic = "force-dynamic"

function verifySignature(
  body: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false
  const hmac = crypto.createHmac("sha256", secret)
  hmac.update(body)
  const expected = `sha256=${hmac.digest("hex")}`
  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

interface WebhookRepo {
  id: number
  name: string
  full_name: string
  default_branch?: string
}

interface WebhookInstallation {
  id: number
}

interface InstallationEventBody {
  action: string
  installation: WebhookInstallation
  repositories?: WebhookRepo[]
}

interface InstallationRepositoriesEventBody {
  action: string
  installation: WebhookInstallation
  repositories_added: WebhookRepo[]
  repositories_removed: WebhookRepo[]
}

interface PushEventBody {
  ref: string
  after: string
  installation?: WebhookInstallation
  repository: WebhookRepo & { default_branch: string }
}

export async function POST(request: Request): Promise<Response> {
  const creds = await getAppCredentials()
  const secret = creds.githubAppWebhookSecret

  const body = await request.text()
  const signature = request.headers.get("x-hub-signature-256")
  if (!verifySignature(body, signature, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 })
  }

  const event = request.headers.get("x-github-event")
  const deliveryId = request.headers.get("x-github-delivery") ?? "unknown"
  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  try {
    switch (event) {
      case "installation":
        await handleInstallation(payload as InstallationEventBody)
        break
      case "installation_repositories":
        await handleInstallationRepositories(
          payload as InstallationRepositoriesEventBody,
        )
        break
      case "push":
        await handlePush(payload as PushEventBody)
        break
      default:
        break
    }
  } catch (error) {
    console.error(`[webhook] ${event} ${deliveryId} failed`, error)
    return NextResponse.json({ error: "handler failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

async function handleInstallation(event: InstallationEventBody): Promise<void> {
  const installationRow = await findInstallation(event.installation.id)

  switch (event.action) {
    case "created":
    case "new_permissions_accepted":
      if (installationRow && event.repositories?.length) {
        await upsertReposForInstallation(installationRow.id, event.repositories)
      }
      break
    case "deleted":
      if (installationRow) {
        await db
          .delete(installation)
          .where(eq(installation.id, installationRow.id))
      }
      break
    case "suspend":
      if (installationRow) {
        await db
          .update(installation)
          .set({ suspendedAt: new Date(), updatedAt: new Date() })
          .where(eq(installation.id, installationRow.id))
      }
      break
    case "unsuspend":
      if (installationRow) {
        await db
          .update(installation)
          .set({ suspendedAt: null, updatedAt: new Date() })
          .where(eq(installation.id, installationRow.id))
      }
      break
    default:
      break
  }
}

async function handleInstallationRepositories(
  event: InstallationRepositoriesEventBody,
): Promise<void> {
  const installationRow = await findInstallation(event.installation.id)
  if (!installationRow) return

  if (event.repositories_added.length > 0) {
    await upsertReposForInstallation(installationRow.id, event.repositories_added)
  }
  for (const r of event.repositories_removed) {
    await db.delete(repo).where(eq(repo.githubRepoId, r.id))
  }
}

async function handlePush(event: PushEventBody): Promise<void> {
  if (!event.installation?.id) return
  if (event.ref !== `refs/heads/${event.repository.default_branch}`) return

  const [repoRow] = await db
    .select()
    .from(repo)
    .where(eq(repo.githubRepoId, event.repository.id))
    .limit(1)

  if (!repoRow || !repoRow.active) return

  const queue = await getQueue()
  await queue.enqueue(
    "translate-repo",
    {
      installationId: event.installation.id,
      repoFullName: event.repository.full_name,
      sha: event.after,
      reason: "push",
    },
    { singletonKey: `translate-repo:${repoRow.id}`, singletonHours: 1 },
  )
}

async function upsertReposForInstallation(
  internalInstallationId: string,
  repos: WebhookRepo[],
): Promise<void> {
  // Default branch is not always on the webhook payload — fetch via API if missing.
  // For now, fall back to "main" which GitHub uses for new repos. The worker will
  // re-read the default branch from the API on each run anyway.
  const resolved = repos.map((r) => ({
    githubRepoId: r.id,
    owner: r.full_name.split("/")[0] ?? "",
    name: r.name,
    defaultBranch: r.default_branch ?? "main",
  }))
  if (resolved.length === 0) return

  await db
    .insert(repo)
    .values(
      resolved.map((r) => ({
        installationId: internalInstallationId,
        githubRepoId: r.githubRepoId,
        owner: r.owner,
        name: r.name,
        defaultBranch: r.defaultBranch,
      })),
    )
    .onConflictDoUpdate({
      target: repo.githubRepoId,
      set: {
        installationId: internalInstallationId,
        owner: sql`excluded.owner`,
        name: sql`excluded.name`,
        defaultBranch: sql`excluded.default_branch`,
        updatedAt: new Date(),
      },
    })
}

async function findInstallation(
  githubInstallationId: number,
): Promise<typeof installation.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(installation)
    .where(eq(installation.githubInstallationId, githubInstallationId))
    .limit(1)
  return row
}

