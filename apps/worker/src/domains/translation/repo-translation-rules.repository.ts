import { db, eq, repoTranslationRules } from "@workspace/db"

export interface RepoRules {
  generalRules: string
  languageRules: Record<string, string>
}

const EMPTY: RepoRules = { generalRules: "", languageRules: {} }

export async function findByRepoId(repoId: string): Promise<RepoRules> {
  const [row] = await db
    .select()
    .from(repoTranslationRules)
    .where(eq(repoTranslationRules.repoId, repoId))
    .limit(1)
  if (!row) return EMPTY
  return {
    generalRules: row.generalRules,
    languageRules: row.languageRules,
  }
}
