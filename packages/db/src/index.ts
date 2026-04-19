import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index";

export * from "./schema/index";
export { schema };
export { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

export type Database = ReturnType<typeof createClient>;

function createClient(connectionString: string): ReturnType<typeof drizzle<typeof schema>> {
  const sql = postgres(connectionString, { prepare: false });
  return drizzle(sql, { schema });
}

export function createDb(connectionString?: string): Database {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return createClient(url);
}

let cached: Database | undefined;

export const db = new Proxy({} as Database, {
  get(_target, prop: string | symbol) {
    cached ??= createDb();
    const value = (cached as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(cached) : value;
  },
});
