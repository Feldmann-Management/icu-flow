import { db, eq, repoTranslationRules } from "@workspace/db"

export type RepoTranslationRulesRow = typeof repoTranslationRules.$inferSelect

export interface RulesView {
  generalRules: string
  languageRules: Record<string, string>
}

const EMPTY: RulesView = { generalRules: "", languageRules: {} }

export async function findByRepoId(repoId: string): Promise<RulesView> {
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

export async function upsert(
  repoId: string,
  values: RulesView,
): Promise<void> {
  await db
    .insert(repoTranslationRules)
    .values({
      repoId,
      generalRules: values.generalRules,
      languageRules: values.languageRules,
    })
    .onConflictDoUpdate({
      target: repoTranslationRules.repoId,
      set: {
        generalRules: values.generalRules,
        languageRules: values.languageRules,
        updatedAt: new Date(),
      },
    })
}
