import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Singleton — enforced by fixing the primary key to "default". Holds
 * admin-configurable knobs that were previously env-only.
 */
export const instanceSettings = pgTable("instance_settings", {
  id: text("id").primaryKey().default("default"),
  openaiApiKey: text("openai_api_key"),
  openaiModel: text("openai_model").notNull().default("gpt-4o-mini"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
