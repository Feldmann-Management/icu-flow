import { appConfig, db } from "@workspace/db"

export interface AppConfigRow {
  id: string
  githubAppId: number
  githubAppSlug: string
  githubAppClientId: string
  githubAppClientSecret: string
  githubAppWebhookSecret: string
  githubAppPrivateKey: string
}

export interface InsertAppConfig {
  githubAppId: number
  githubAppSlug: string
  githubAppClientId: string
  githubAppClientSecret: string
  githubAppWebhookSecret: string
  githubAppPrivateKey: string
}

export async function exists(): Promise<boolean> {
  const rows = await db.select({ id: appConfig.id }).from(appConfig).limit(1)
  return rows.length > 0
}

export async function insertDefault(values: InsertAppConfig): Promise<void> {
  await db.insert(appConfig).values({ id: "default", ...values })
}
