import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { db, eq, inArray, installation, repo } from "@workspace/db"

import { auth } from "@/lib/auth"

import { ConnectGitHubButton } from "./connect-github-button"
import { SignOutButton } from "./sign-out-button"

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/signin")
  const user = session.user

  const installations = await db
    .select()
    .from(installation)
    .where(eq(installation.connectedByUserId, user.id))
    .orderBy(installation.createdAt)

  const installationIds = installations.map((row) => row.id)
  const repos = installationIds.length
    ? await db.select().from(repo).where(inArray(repo.installationId, installationIds))
    : []

  const reposByInstallation = new Map<string, typeof repos>()
  for (const r of repos) {
    const list = reposByInstallation.get(r.installationId) ?? []
    list.push(r)
    reposByInstallation.set(r.installationId, list)
  }

  return (
    <main className="flex min-h-svh items-start justify-center bg-background p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6 pt-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {user.name} ({user.email})
            </p>
          </div>
          <SignOutButton />
        </div>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">GitHub installations</h2>
            <ConnectGitHubButton />
          </div>

          {installations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No installations yet. Connect the ICU Flow GitHub App to your
                account or organization to start translating repositories.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {installations.map((inst) => {
                const instRepos = reposByInstallation.get(inst.id) ?? []
                return (
                  <li
                    key={inst.id}
                    className="rounded-lg border p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{inst.accountLogin}</p>
                        <p className="text-xs text-muted-foreground">
                          {inst.accountType} · installation #
                          {inst.githubInstallationId}
                          {inst.suspendedAt ? " · suspended" : ""}
                        </p>
                      </div>
                    </div>
                    {instRepos.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1 text-sm">
                        {instRepos.map((r) => (
                          <li key={r.id} className="text-muted-foreground">
                            {r.owner}/{r.name}
                            <span className="text-xs"> · {r.defaultBranch}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
