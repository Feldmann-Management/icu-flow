import { NextResponse, type NextRequest } from "next/server"

import { hasAppCredentials } from "@/lib/github"

export const config = {
  // Gate pages only — API routes handle "not configured" state on their own.
  matcher: ["/((?!_next|favicon.ico|setup|api).*)"],
}

export const runtime = "nodejs"

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (await hasAppCredentials()) {
    return NextResponse.next()
  }
  const setupUrl = new URL("/setup", request.url)
  return NextResponse.redirect(setupUrl)
}
