import crypto from "node:crypto"

import { cookies } from "next/headers"

import { appUrl } from "@/lib/app-url"
import { hasAppCredentials } from "@/lib/github"

export const dynamic = "force-dynamic"

const STATE_COOKIE = "icu_flow_setup_state"
const OWNER_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,38}[a-zA-Z0-9])?$/

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData()
  const owner = formData.get("owner")?.toString().trim() ?? ""
  return handle(owner)
}

// Preserve the old no-owner GET path (e.g. links in docs).
export async function GET(): Promise<Response> {
  return handle("")
}

async function handle(owner: string): Promise<Response> {
  const base = appUrl()

  if (await hasAppCredentials()) {
    return Response.redirect(new URL("/dashboard", base), 302)
  }

  if (owner && !OWNER_RE.test(owner)) {
    return Response.redirect(
      new URL("/setup?error=invalid_owner", base),
      302,
    )
  }

  const state = crypto.randomBytes(16).toString("hex")

  const jar = await cookies()
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: base.startsWith("https://"),
    maxAge: 10 * 60,
    path: "/",
  })

  const manifest = {
    name: "ICU Flow",
    url: base,
    hook_attributes: {
      url: `${base}/api/webhooks/github`,
    },
    redirect_url: `${base}/api/github/setup/callback`,
    callback_urls: [`${base}/api/github/install/callback`],
    setup_url: `${base}/api/github/install/callback`,
    setup_on_update: true,
    public: false,
    default_permissions: {
      contents: "write",
      pull_requests: "write",
      metadata: "read",
    },
    default_events: ["push"],
  }

  const manifestJson = JSON.stringify(manifest)
  const createUrl = owner
    ? `https://github.com/organizations/${encodeURIComponent(owner)}/settings/apps/new?state=${state}`
    : `https://github.com/settings/apps/new?state=${state}`

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Creating GitHub App…</title>
  </head>
  <body>
    <p>Redirecting to GitHub…</p>
    <form id="f" method="POST" action="${createUrl}">
      <input type="hidden" name="manifest" value='${escapeAttr(manifestJson)}' />
      <noscript>
        <button type="submit">Continue to GitHub</button>
      </noscript>
    </form>
    <script>document.getElementById('f').submit();</script>
  </body>
</html>`

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}
