import { buttonVariants } from "@workspace/ui/components/button"

import { getAppCredentials } from "@/lib/github"

export async function ConnectGitHubButton() {
  const creds = await getAppCredentials()
  return (
    <a
      href={`https://github.com/apps/${creds.githubAppSlug}/installations/new`}
      className={buttonVariants()}
    >
      Connect GitHub
    </a>
  )
}
