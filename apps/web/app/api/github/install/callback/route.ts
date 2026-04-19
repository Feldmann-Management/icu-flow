import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { db, installation, repo, sql } from "@workspace/db"

import { appUrl } from "@/lib/app-url"
import { auth } from "@/lib/auth"
import { fetchInstallation, fetchInstallationRepos } from "@/lib/github"

export async function GET(request: Request): Promise<Response> {
  const base = appUrl()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.redirect(new URL("/signin", base))
  }

  const url = new URL(request.url)
  const installationIdParam = url.searchParams.get("installation_id")
  const setupAction = url.searchParams.get("setup_action")

  if (!installationIdParam) {
    return NextResponse.redirect(new URL("/dashboard?error=missing_id", base))
  }
  const installationId = Number(installationIdParam)
  if (!Number.isFinite(installationId)) {
    return NextResponse.redirect(new URL("/dashboard?error=bad_id", base))
  }

  if (setupAction === "request") {
    return NextResponse.redirect(
      new URL("/dashboard?notice=install_requested", base),
    )
  }

  const metadata = await fetchInstallation(installationId)
  const repos = await fetchInstallationRepos(installationId)

  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(installation)
      .values({
        githubInstallationId: metadata.id,
        accountType: metadata.accountType,
        accountLogin: metadata.accountLogin,
        accountId: metadata.accountId,
        connectedByUserId: session.user.id,
        suspendedAt: metadata.suspendedAt ? new Date(metadata.suspendedAt) : null,
      })
      .onConflictDoUpdate({
        target: installation.githubInstallationId,
        set: {
          accountType: metadata.accountType,
          accountLogin: metadata.accountLogin,
          accountId: metadata.accountId,
          connectedByUserId: session.user.id,
          suspendedAt: metadata.suspendedAt ? new Date(metadata.suspendedAt) : null,
          updatedAt: new Date(),
        },
      })
      .returning()

    if (!inserted) {
      throw new Error("Failed to upsert installation")
    }

    if (repos.length > 0) {
      await tx
        .insert(repo)
        .values(
          repos.map((r) => ({
            installationId: inserted.id,
            githubRepoId: r.githubRepoId,
            owner: r.owner,
            name: r.name,
            defaultBranch: r.defaultBranch,
          })),
        )
        .onConflictDoUpdate({
          target: repo.githubRepoId,
          set: {
            installationId: inserted.id,
            owner: sql`excluded.owner`,
            name: sql`excluded.name`,
            defaultBranch: sql`excluded.default_branch`,
            updatedAt: new Date(),
          },
        })
    }
  })

  return NextResponse.redirect(new URL("/dashboard?connected=1", base))
}
