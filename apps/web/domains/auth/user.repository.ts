import { db, user } from "@workspace/db"

export async function existsAny(): Promise<boolean> {
  const rows = await db.select({ id: user.id }).from(user).limit(1)
  return rows.length > 0
}
