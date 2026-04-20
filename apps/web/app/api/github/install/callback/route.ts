import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { appUrl } from "@/lib/app-url"
import { auth } from "@/lib/auth"
import { syncFromGitHub } from "@/domains/installations/installations.service"

export async function GET(request: Request): Promise<Response> {
  const base = appUrl()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.redirect(new URL("/signin", base))
  }

  const url = new URL(request.url)
  const installationIdParam = url.searchParams.get("installation_id")
  const setupAction = url.searchParams.get("setup_action")

  if (!installationIdParam) {
    return NextResponse.redirect(new URL("/dashboard?error=missing_id", base))
  }
  const installationId = Number(installationIdParam)
  if (!Number.isFinite(installationId)) {
    return NextResponse.redirect(new URL("/dashboard?error=bad_id", base))
  }

  if (setupAction === "request") {
    return NextResponse.redirect(
      new URL("/dashboard?notice=install_requested", base),
    )
  }

  await syncFromGitHub(installationId, session.user.id)
  return NextResponse.redirect(new URL("/dashboard?connected=1", base))
}
