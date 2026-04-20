import { db, instanceSettings } from "@workspace/db"

export interface InstanceSettingsRow {
  openaiApiKey: string | null
  openaiModel: string | null
}

export interface InstanceSettingsPatch {
  // null = clear; undefined = leave unchanged; string = set
  openaiApiKey?: string | null
  openaiModel?: string
}

export async function findOne(): Promise<InstanceSettingsRow | null> {
  const rows = await db.select().from(instanceSettings).limit(1)
  const row = rows[0]
  if (!row) return null
  return { openaiApiKey: row.openaiApiKey, openaiModel: row.openaiModel }
}

export async function upsert(patch: InstanceSettingsPatch): Promise<void> {
  await db
    .insert(instanceSettings)
    .values({
      id: "default",
      openaiApiKey: patch.openaiApiKey ?? null,
      openaiModel: patch.openaiModel ?? "gpt-4o-mini",
    })
    .onConflictDoUpdate({
      target: instanceSettings.id,
      set: {
        ...(patch.openaiApiKey !== undefined
          ? { openaiApiKey: patch.openaiApiKey }
          : {}),
        ...(patch.openaiModel !== undefined
          ? { openaiModel: patch.openaiModel }
          : {}),
        updatedAt: new Date(),
      },
    })
}
