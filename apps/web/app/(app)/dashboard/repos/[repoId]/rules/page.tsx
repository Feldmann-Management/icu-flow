import Link from "next/link"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { buttonVariants } from "@workspace/ui/components/button"

import { auth } from "@/lib/auth"
import { loadRulesPage } from "@/domains/repo-translation-rules/repo-translation-rules.service"

import { RulesForm } from "./rules-form"

export default async function RepoRulesPage({
  params,
}: {
  params: Promise<{ repoId: string }>
}): Promise<React.ReactElement> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/signin")

  const { repoId } = await params
  const data = await loadRulesPage(repoId, session.user.id)
  if (!data) notFound()

  const targets = data.config
    ? data.config.targets.filter((t) => t !== data.config!.source)
    : []

  return (
    <main className="flex min-h-svh items-start justify-center bg-background p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6 pt-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Translation rules
            </h1>
            <p className="text-sm text-muted-foreground">
              {data.repo.owner}/{data.repo.name}
            </p>
          </div>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Back
          </Link>
        </div>

        <RulesForm
          repoId={data.repo.id}
          initial={data.rules}
          targets={targets}
          configError={data.configError}
        />
      </div>
    </main>
  )
}
