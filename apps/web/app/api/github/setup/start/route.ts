import { cookies } from "next/headers"

import { appUrl } from "@/lib/app-url"
import {
  buildManifestForm,
  hasCredentials,
  InvalidOwnerError,
} from "@/domains/app-config/app-config.service"

export const dynamic = "force-dynamic"

const STATE_COOKIE = "icu_flow_setup_state"

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData()
  const owner = formData.get("owner")?.toString() ?? ""
  return handle(owner)
}

// Preserve the old no-owner GET path (e.g. links in docs).
export async function GET(): Promise<Response> {
  return handle("")
}

async function handle(owner: string): Promise<Response> {
  const base = appUrl()

  if (await hasCredentials()) {
    return Response.redirect(new URL("/dashboard", base), 302)
  }

  let form
  try {
    form = buildManifestForm(owner)
  } catch (err) {
    if (err instanceof InvalidOwnerError) {
      return Response.redirect(
        new URL("/setup?error=invalid_owner", base),
        302,
      )
    }
    throw err
  }

  const jar = await cookies()
  jar.set(STATE_COOKIE, form.state, {
    httpOnly: true,
    sameSite: "lax",
    secure: base.startsWith("https://"),
    maxAge: 10 * 60,
    path: "/",
  })

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Creating GitHub App…</title>
  </head>
  <body>
    <p>Redirecting to GitHub…</p>
    <form id="f" method="POST" action="${form.createUrl}">
      <input type="hidden" name="manifest" value='${escapeAttr(form.manifestJson)}' />
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
