import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { testKey } from "@/domains/settings/settings.service"

const bodySchema = z.object({
  apiKey: z.string().optional(),
})

/**
 * Probe the given OpenAI API key (or the saved one if empty) with a
 * cheap 1-token completion.
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

  const result = await testKey(parsed.data.apiKey)
  return NextResponse.json(result)
}
