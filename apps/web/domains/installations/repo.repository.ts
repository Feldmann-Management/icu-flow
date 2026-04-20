import { db, eq, inArray, repo, sql } from "@workspace/db"

export type RepoRow = typeof repo.$inferSelect

export interface RepoUpsert {
  installationId: string
  githubRepoId: number
  owner: string
  name: string
  defaultBranch: string
}

export async function findByInstallationIds(
  installationIds: string[],
): Promise<RepoRow[]> {
  if (installationIds.length === 0) return []
  return db.select().from(repo).where(inArray(repo.installationId, installationIds))
}

export async function findByGithubRepoId(
  githubRepoId: number,
): Promise<RepoRow | undefined> {
  const [row] = await db
    .select()
    .from(repo)
    .where(eq(repo.githubRepoId, githubRepoId))
    .limit(1)
  return row
}

export async function upsertMany(values: RepoUpsert[]): Promise<void> {
  if (values.length === 0) return
  await db
    .insert(repo)
    .values(values)
    .onConflictDoUpdate({
      target: repo.githubRepoId,
      set: {
        installationId: sql`excluded.installation_id`,
        owner: sql`excluded.owner`,
        name: sql`excluded.name`,
        defaultBranch: sql`excluded.default_branch`,
        updatedAt: new Date(),
      },
    })
}

export async function deleteByGithubRepoId(githubRepoId: number): Promise<void> {
  await db.delete(repo).where(eq(repo.githubRepoId, githubRepoId))
}
