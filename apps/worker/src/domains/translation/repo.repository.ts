import { and, db, eq, repo as repoTable } from "@workspace/db"

export type RepoRow = typeof repoTable.$inferSelect

export async function findByOwnerAndName(
  owner: string,
  name: string,
): Promise<RepoRow | undefined> {
  const [row] = await db
    .select()
    .from(repoTable)
    .where(and(eq(repoTable.owner, owner), eq(repoTable.name, name)))
    .limit(1)
  return row
}

export async function setLastProcessedSha(
  repoId: string,
  sha: string,
): Promise<void> {
  await db
    .update(repoTable)
    .set({ lastProcessedSha: sha, updatedAt: new Date() })
    .where(eq(repoTable.id, repoId))
}
