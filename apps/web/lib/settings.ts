import { db, instanceSettings, sql } from "@workspace/db"

export const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1"] as const
export type OpenAIModel = (typeof OPENAI_MODELS)[number]
export const DEFAULT_MODEL: OpenAIModel = "gpt-4o-mini"

export interface InstanceSettings {
  openaiApiKey: string | null
  openaiModel: OpenAIModel
}

export async function getInstanceSettings(): Promise<InstanceSettings> {
  const rows = await db.select().from(instanceSettings).limit(1)
  const row = rows[0]
  if (!row) {
    return { openaiApiKey: null, openaiModel: DEFAULT_MODEL }
  }
  return {
    openaiApiKey: row.openaiApiKey,
    openaiModel: (row.openaiModel as OpenAIModel) ?? DEFAULT_MODEL,
  }
}

export async function upsertInstanceSettings(
  update: Partial<InstanceSettings>,
): Promise<void> {
  await db
    .insert(instanceSettings)
    .values({
      id: "default",
      openaiApiKey: update.openaiApiKey ?? null,
      openaiModel: update.openaiModel ?? DEFAULT_MODEL,
    })
    .onConflictDoUpdate({
      target: instanceSettings.id,
      set: {
        ...(update.openaiApiKey !== undefined
          ? { openaiApiKey: update.openaiApiKey }
          : {}),
        ...(update.openaiModel !== undefined
          ? { openaiModel: update.openaiModel }
          : {}),
        updatedAt: new Date(),
      },
    })
  void sql
}
