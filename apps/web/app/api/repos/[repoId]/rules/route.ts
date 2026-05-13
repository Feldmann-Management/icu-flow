import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { saveRules } from "@/domains/repo-translation-rules/repo-translation-rules.service"

const bodySchema = z.object({
  generalRules: z.string(),
  languageRules: z.record(z.string(), z.string()),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> },
): Promise<Response> {
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

  const { repoId } = await params
  const result = await saveRules(repoId, session.user.id, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "save failed" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
