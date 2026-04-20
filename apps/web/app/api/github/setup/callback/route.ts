import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { appUrl } from "@/lib/app-url"
import {
  completeManifest,
  hasCredentials,
} from "@/domains/app-config/app-config.service"

export const dynamic = "force-dynamic"

const STATE_COOKIE = "icu_flow_setup_state"

export async function GET(request: Request): Promise<Response> {
  const base = appUrl()
  if (await hasCredentials()) {
    return NextResponse.redirect(new URL("/dashboard", base))
  }

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  const jar = await cookies()
  const expectedState = jar.get(STATE_COOKIE)?.value
  jar.delete(STATE_COOKIE)

  const result = await completeManifest(code, state, expectedState)
  if (!result.ok) {
    return NextResponse.redirect(new URL(`/setup?error=${result.error}`, base))
  }

  return NextResponse.redirect(new URL("/dashboard?setup=done", base))
}
