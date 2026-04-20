import { NextResponse, type NextRequest } from "next/server"

import { hasAppCredentials } from "@/lib/github"
import { hasAnyUser } from "@/lib/users"

export const config = {
  // Gate all pages. API routes enforce their own checks.
  matcher: ["/((?!_next|favicon.ico|api).*)"],
}

export const runtime = "nodejs"

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const anyUser = await hasAnyUser()
  const hasApp = await hasAppCredentials()

  // /setup: only reachable when users exist but no App configured.
  if (pathname === "/setup") {
    if (!anyUser) return NextResponse.redirect(new URL("/signup", request.url))
    if (hasApp) return NextResponse.redirect(new URL("/dashboard", request.url))
    return NextResponse.next()
  }

  // /signup: only reachable when NO user exists. First-run only.
  if (pathname === "/signup") {
    if (anyUser) return NextResponse.redirect(new URL("/signin", request.url))
    return NextResponse.next()
  }

  // /signin: always reachable.
  if (pathname === "/signin") return NextResponse.next()

  // Everything else requires a user AND an App.
  if (!anyUser) return NextResponse.redirect(new URL("/signup", request.url))
  if (!hasApp) return NextResponse.redirect(new URL("/setup", request.url))
  return NextResponse.next()
}
