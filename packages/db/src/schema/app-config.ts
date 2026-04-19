import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Singleton row — enforced by fixing the primary key to "default".
 * Holds the GitHub App credentials created via the first-run manifest flow.
 */
export const appConfig = pgTable("app_config", {
  id: text("id").primaryKey().default("default"),
  githubAppId: bigint("github_app_id", { mode: "number" }).notNull(),
  githubAppSlug: text("github_app_slug").notNull(),
  githubAppClientId: text("github_app_client_id").notNull(),
  githubAppClientSecret: text("github_app_client_secret").notNull(),
  githubAppWebhookSecret: text("github_app_webhook_secret").notNull(),
  githubAppPrivateKey: text("github_app_private_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
