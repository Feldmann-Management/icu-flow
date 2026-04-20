import { toNextJsHandler } from "better-auth/next-js"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { isSignupClosed } from "@/domains/auth/auth.service"

const handler = toNextJsHandler(auth)

export const GET = handler.GET

export async function POST(request: Request): Promise<Response> {
  // Reject sign-up endpoints once a user exists. This is the server-level
  // block — removing the /signup page is not enough; someone could POST
  // directly.
  const url = new URL(request.url)
  if (url.pathname.includes("/sign-up") && (await isSignupClosed())) {
    return NextResponse.json(
      { error: "Sign-ups are closed on this instance." },
      { status: 403 },
    )
  }
  return handler.POST(request)
}
