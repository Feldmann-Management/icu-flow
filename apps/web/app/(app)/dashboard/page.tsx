import { headers } from "next/headers";

import { auth } from "@/lib/auth";

import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;

  return (
    <main className="flex min-h-svh items-start justify-center bg-background p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6 pt-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <SignOutButton />
        </div>
        <div className="rounded-lg border p-6">
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <p className="font-medium">{user?.name}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          GitHub connection + repo list will live here once the App install flow is wired up.
        </p>
      </div>
    </main>
  );
}
