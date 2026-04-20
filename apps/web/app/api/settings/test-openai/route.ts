import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { getInstanceSettings } from "@/lib/settings"

const bodySchema = z.object({
  apiKey: z.string().optional(),
})

/**
 * Probe the given OpenAI API key (or the saved one if empty) with a
 * cheap 1-token completion. Returns { ok: true } on success, or
 * { ok: false, error } with a human-readable message on failure.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid body" })
  }

  let key = parsed.data.apiKey?.trim()
  if (!key) {
    const saved = await getInstanceSettings()
    key = saved.openaiApiKey ?? undefined
  }
  if (!key) {
    return NextResponse.json({ ok: false, error: "no key provided or saved" })
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 1,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    let message = `HTTP ${response.status}`
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } }
      if (parsed.error?.message) message = parsed.error.message
    } catch {
      // fall through with HTTP status
    }
    return NextResponse.json({ ok: false, error: message })
  }

  return NextResponse.json({ ok: true })
}
