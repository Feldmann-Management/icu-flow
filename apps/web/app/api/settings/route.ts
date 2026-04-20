import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { OPENAI_MODELS, upsertInstanceSettings } from "@/lib/settings"

const bodySchema = z.object({
  // Empty string means "keep existing" (form didn't enter a new key).
  openaiApiKey: z.string().optional(),
  openaiModel: z.enum(OPENAI_MODELS),
})

export async function POST(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const key = parsed.data.openaiApiKey?.trim()
  await upsertInstanceSettings({
    ...(key ? { openaiApiKey: key } : {}),
    openaiModel: parsed.data.openaiModel,
  })
  return NextResponse.json({ ok: true })
}
