import { NextResponse } from "next/server"

import { getAppCredentials } from "@workspace/github"

import {
  applyInstallationEvent,
  applyRepositoriesEvent,
} from "@/domains/installations/installations.service"
import { verifySignature } from "@/domains/installations/webhook-signature"
import { enqueueForPush } from "@/domains/translations/translations.service"

export const dynamic = "force-dynamic"

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
  const body = await request.text()
  const signature = request.headers.get("x-hub-signature-256")
  if (!verifySignature(body, signature, creds.githubAppWebhookSecret)) {
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
      case "installation": {
        const body = payload as InstallationEventBody
        await applyInstallationEvent(
          body.action,
          body.installation.id,
          body.repositories,
        )
        break
      }
      case "installation_repositories": {
        const body = payload as InstallationRepositoriesEventBody
        await applyRepositoriesEvent(
          body.installation.id,
          body.repositories_added,
          body.repositories_removed,
        )
        break
      }
      case "push": {
        const body = payload as PushEventBody
        if (!body.installation?.id) break
        await enqueueForPush({
          installationId: body.installation.id,
          githubRepoId: body.repository.id,
          repoFullName: body.repository.full_name,
          ref: body.ref,
          defaultBranch: body.repository.default_branch,
          sha: body.after,
        })
        break
      }
      default:
        break
    }
  } catch (error) {
    console.error(`[webhook] ${event} ${deliveryId} failed`, error)
    return NextResponse.json({ error: "handler failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
