import { db, instanceSettings } from "@workspace/db"

export interface InstanceSettingsRow {
  openaiApiKey: string | null
  openaiModel: string | null
}

export async function findOne(): Promise<InstanceSettingsRow | null> {
  const rows = await db.select().from(instanceSettings).limit(1)
  const row = rows[0]
  if (!row) return null
  return { openaiApiKey: row.openaiApiKey, openaiModel: row.openaiModel }
}
