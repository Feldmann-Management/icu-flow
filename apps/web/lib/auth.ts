import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

import { db, schema } from "@workspace/db"

import { appUrl } from "./app-url"

export const auth = betterAuth({
  baseURL: appUrl(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
})
