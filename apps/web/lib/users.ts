import { db, user } from "@workspace/db"

/** Returns true if at least one user row exists. */
export async function hasAnyUser(): Promise<boolean> {
  const rows = await db.select({ id: user.id }).from(user).limit(1)
  return rows.length > 0
}
