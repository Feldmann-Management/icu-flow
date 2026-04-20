import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { appConfig, db } from "@workspace/db"
import { anonClient, hasAppCredentials } from "@workspace/github"

import { appUrl } from "@/lib/app-url"

export const dynamic = "force-dynamic"

const STATE_COOKIE = "icu_flow_setup_state"

interface ConversionResponse {
  id: number
  slug: string
  client_id: string
  client_secret: string
  webhook_secret: string
  pem: string
}

export async function GET(request: Request): Promise<Response> {
  const base = appUrl()
  if (await hasAppCredentials()) {
    return NextResponse.redirect(new URL("/dashboard", base))
  }

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  const jar = await cookies()
  const expectedState = jar.get(STATE_COOKIE)?.value
  jar.delete(STATE_COOKIE)

  if (!code) {
    return NextResponse.redirect(new URL("/setup?error=missing_code", base))
  }
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/setup?error=bad_state", base))
  }

  const anon = anonClient()
  const { data } = await anon.request(
    "POST /app-manifests/{code}/conversions",
    { code },
  )
  const conversion = data as unknown as ConversionResponse

  await db.insert(appConfig).values({
    id: "default",
    githubAppId: conversion.id,
    githubAppSlug: conversion.slug,
    githubAppClientId: conversion.client_id,
    githubAppClientSecret: conversion.client_secret,
    githubAppWebhookSecret: conversion.webhook_secret,
    githubAppPrivateKey: conversion.pem,
  })

  return NextResponse.redirect(new URL("/dashboard?setup=done", base))
}
