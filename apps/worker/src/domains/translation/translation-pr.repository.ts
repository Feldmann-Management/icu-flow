import { db, translationPr } from "@workspace/db"

export interface UpsertPrInput {
  repoId: string
  githubPrNumber: number
  branchName: string
  headSha: string
}

export async function upsert(input: UpsertPrInput): Promise<{ id: string }> {
  const [row] = await db
    .insert(translationPr)
    .values({
      repoId: input.repoId,
      githubPrNumber: input.githubPrNumber,
      branchName: input.branchName,
      headSha: input.headSha,
      status: "open",
    })
    .onConflictDoUpdate({
      target: [translationPr.repoId, translationPr.githubPrNumber],
      set: {
        headSha: input.headSha,
        status: "open",
        updatedAt: new Date(),
      },
    })
    .returning({ id: translationPr.id })
  if (!row) throw new Error("failed to upsert translation_pr row")
  return row
}
