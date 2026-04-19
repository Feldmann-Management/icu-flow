import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type Database = ReturnType<typeof createDb>;

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}

let cached: Database | undefined;

export const db = new Proxy({} as Database, {
  get(_target, prop: string | symbol) {
    cached ??= createDb();
    const value = (cached as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(cached) : value;
  },
});

export { schema };
