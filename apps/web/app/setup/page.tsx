import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { appUrl } from "@/lib/app-url"
import { auth } from "@/lib/auth"
import { hasAppCredentials } from "@/lib/github"

export const dynamic = "force-dynamic"

export default async function SetupPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/signin")
  if (await hasAppCredentials()) redirect("/dashboard")

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
          <CardContent>
            <form method="POST" action="/api/github/setup/start">
              <FieldGroup>
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  GitHub will create an App with the permissions we need
                  (read/write contents + pull requests). No fields to fill in on
                  GitHub&apos;s side — clicking below posts a manifest and
                  returns you here once it&apos;s created.
                  <p className="mt-3 text-xs">
                    Public URL: <code>{url}</code> — must be reachable from
                    GitHub for webhooks to work.
                  </p>
                </div>

                <Field>
                  <FieldLabel htmlFor="owner">GitHub owner</FieldLabel>
                  <Input
                    id="owner"
                    name="owner"
                    placeholder="my-org-slug"
                    autoComplete="off"
                  />
                  <FieldDescription>
                    Leave blank to create the App under your personal account.
                    Enter an organization slug (e.g. <code>acme-inc</code>) to
                    create it under that org — you must be an owner of the org
                    on GitHub.
                  </FieldDescription>
                </Field>

                <Field>
                  <Button type="submit" className="w-full">
                    Create GitHub App
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
