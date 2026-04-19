import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const accountTypeEnum = pgEnum("account_type", ["User", "Organization"]);
export const triggerReasonEnum = pgEnum("trigger_reason", ["push", "manual", "retry"]);
export const runStatusEnum = pgEnum("run_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);
export const prStatusEnum = pgEnum("pr_status", ["open", "merged", "closed"]);

export const installation = pgTable("installation", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubInstallationId: bigint("github_installation_id", { mode: "number" })
    .notNull()
    .unique(),
  accountType: accountTypeEnum("account_type").notNull(),
  accountLogin: text("account_login").notNull(),
  accountId: bigint("account_id", { mode: "number" }).notNull(),
  connectedByUserId: text("connected_by_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const repo = pgTable(
  "repo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    installationId: uuid("installation_id")
      .notNull()
      .references(() => installation.id, { onDelete: "cascade" }),
    githubRepoId: bigint("github_repo_id", { mode: "number" }).notNull().unique(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    defaultBranch: text("default_branch").notNull(),
    active: boolean("active").notNull().default(true),
    lastProcessedSha: text("last_processed_sha"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("repo_owner_name_idx").on(table.owner, table.name)],
);

export const translationPr = pgTable(
  "translation_pr",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repo.id, { onDelete: "cascade" }),
    githubPrNumber: integer("github_pr_number").notNull(),
    branchName: text("branch_name").notNull(),
    headSha: text("head_sha").notNull(),
    status: prStatusEnum("status").notNull().default("open"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("translation_pr_repo_number_idx").on(table.repoId, table.githubPrNumber),
    uniqueIndex("translation_pr_repo_open_idx")
      .on(table.repoId)
      .where(sql`status = 'open'`),
  ],
);

export const translationRun = pgTable("translation_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  repoId: uuid("repo_id")
    .notNull()
    .references(() => repo.id, { onDelete: "cascade" }),
  triggerSha: text("trigger_sha").notNull(),
  triggerReason: triggerReasonEnum("trigger_reason").notNull(),
  status: runStatusEnum("status").notNull().default("pending"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  error: text("error"),
  keysTranslated: integer("keys_translated").notNull().default(0),
  localesTouched: text("locales_touched")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  prId: uuid("pr_id").references(() => translationPr.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
