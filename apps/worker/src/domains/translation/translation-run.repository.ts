import { db, eq, translationRun } from "@workspace/db"

type TriggerReason = typeof translationRun.$inferInsert["triggerReason"]

export interface CreateRunInput {
  repoId: string
  triggerSha: string
  triggerReason: TriggerReason
}

export async function create(input: CreateRunInput): Promise<{ id: string }> {
  const [row] = await db
    .insert(translationRun)
    .values({
      repoId: input.repoId,
      triggerSha: input.triggerSha,
      triggerReason: input.triggerReason,
      status: "running",
      startedAt: new Date(),
    })
    .returning({ id: translationRun.id })
  if (!row) throw new Error("failed to create translation_run row")
  return row
}

export interface MarkSucceededInput {
  id: string
  keysTranslated: number
  localesTouched: string[]
  prId: string | null
}

export async function markSucceeded(input: MarkSucceededInput): Promise<void> {
  await db
    .update(translationRun)
    .set({
      status: "succeeded",
      finishedAt: new Date(),
      keysTranslated: input.keysTranslated,
      localesTouched: input.localesTouched,
      prId: input.prId,
    })
    .where(eq(translationRun.id, input.id))
}

export async function markFailed(id: string, message: string): Promise<void> {
  await db
    .update(translationRun)
    .set({ status: "failed", finishedAt: new Date(), error: message })
    .where(eq(translationRun.id, id))
}
