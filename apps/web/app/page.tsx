"use client";

import { Trans } from "@lingui/macro";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

export default function Page() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            <Trans>ICU Flow — automated translations for your app messages</Trans>
          </h1>
          <p className="text-muted-foreground">
            <Trans>
              Connect a git repository. New source-language messages are translated to every
              target language via AI and opened as a pull request.
            </Trans>
          </p>
          <div>
            <Button size="default">
              <Trans>Get started</Trans>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Coming soon</Trans>
            </CardTitle>
            <CardDescription>
              <Trans>Connect a repository and configure target languages.</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              <Trans>
                This is a sample landing page. The real onboarding flow lands in a later step.
              </Trans>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
