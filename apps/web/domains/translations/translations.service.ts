import * as repoRepo from "@/domains/installations/repo.repository"
import { getQueue } from "@/lib/queue"

export interface EnqueuePushInput {
  installationId: number
  githubRepoId: number
  repoFullName: string
  ref: string
  defaultBranch: string
  sha: string
}

/** Returns true if the push was enqueued (only default-branch pushes for active repos). */
export async function enqueueForPush(input: EnqueuePushInput): Promise<boolean> {
  if (input.ref !== `refs/heads/${input.defaultBranch}`) return false

  const row = await repoRepo.findByGithubRepoId(input.githubRepoId)
  if (!row || !row.active) return false

  const queue = await getQueue()
  await queue.enqueue("translate-repo", {
    installationId: input.installationId,
    repoFullName: input.repoFullName,
    sha: input.sha,
    reason: "push",
  })
  return true
}
