import { db, eq, installation } from "@workspace/db"

export type InstallationRow = typeof installation.$inferSelect
export type AccountType = InstallationRow["accountType"]

export interface InstallationUpsert {
  githubInstallationId: number
  accountType: AccountType
  accountLogin: string
  accountId: number
  connectedByUserId: string
  suspendedAt: Date | null
}

export async function findByGithubId(
  githubInstallationId: number,
): Promise<InstallationRow | undefined> {
  const [row] = await db
    .select()
    .from(installation)
    .where(eq(installation.githubInstallationId, githubInstallationId))
    .limit(1)
  return row
}

export async function findByConnectedUser(
  userId: string,
): Promise<InstallationRow[]> {
  return db
    .select()
    .from(installation)
    .where(eq(installation.connectedByUserId, userId))
    .orderBy(installation.createdAt)
}

export async function upsert(values: InstallationUpsert): Promise<InstallationRow> {
  const [row] = await db
    .insert(installation)
    .values(values)
    .onConflictDoUpdate({
      target: installation.githubInstallationId,
      set: {
        accountType: values.accountType,
        accountLogin: values.accountLogin,
        accountId: values.accountId,
        connectedByUserId: values.connectedByUserId,
        suspendedAt: values.suspendedAt,
        updatedAt: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error("Failed to upsert installation")
  return row
}

export async function deleteById(id: string): Promise<void> {
  await db.delete(installation).where(eq(installation.id, id))
}

export async function setSuspended(
  id: string,
  suspendedAt: Date | null,
): Promise<void> {
  await db
    .update(installation)
    .set({ suspendedAt, updatedAt: new Date() })
    .where(eq(installation.id, id))
}
