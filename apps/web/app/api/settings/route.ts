import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { OPENAI_MODELS, upsert } from "@/domains/settings/settings.service"

const bodySchema = z.object({
  openaiApiKey: z.string(),
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

  await upsert(parsed.data)
  return NextResponse.json({ ok: true })
}
