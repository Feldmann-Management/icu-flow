import { redirect } from "next/navigation"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { appUrl } from "@/lib/app-url"
import { hasAppCredentials } from "@/lib/github"

export const dynamic = "force-dynamic"

export default async function SetupPage() {
  if (await hasAppCredentials()) {
    redirect("/dashboard")
  }

  const url = appUrl()

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to ICU Flow</CardTitle>
            <CardDescription>
              First-run setup. We&apos;ll create a GitHub App that this instance
              uses to access connected repositories.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-md border p-4 text-sm">
              <p className="text-muted-foreground">
                GitHub will create an App on your account or organization with
                the permissions we need (read/write contents + pull requests).
                No fields to fill in — clicking the button below posts a
                manifest to GitHub and returns you here once it&apos;s created.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                This app&apos;s public URL is <code>{url}</code> — it must be
                reachable from GitHub for webhooks to work.
              </p>
            </div>
            <form method="GET" action="/api/github/setup/start">
              <Button type="submit" className="w-full">
                Create GitHub App
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
