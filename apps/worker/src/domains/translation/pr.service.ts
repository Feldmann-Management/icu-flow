import { installationClient } from "@workspace/github"

import { TRANSLATION_BRANCH } from "./git.service"

export interface OpenOrUpdatePrParams {
  installationId: number
  owner: string
  name: string
  defaultBranch: string
  title: string
  body: string
}

export interface PrResult {
  number: number
  headSha: string
  action: "opened" | "existing"
}

export async function openOrUpdatePullRequest(
  params: OpenOrUpdatePrParams,
): Promise<PrResult> {
  const octokit = await installationClient(params.installationId)

  const existing = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
    owner: params.owner,
    repo: params.name,
    head: `${params.owner}:${TRANSLATION_BRANCH}`,
    state: "open",
  })

  const branchRef = await octokit.request(
    "GET /repos/{owner}/{repo}/branches/{branch}",
    {
      owner: params.owner,
      repo: params.name,
      branch: TRANSLATION_BRANCH,
    },
  )
  const headSha = branchRef.data.commit.sha

  if (existing.data.length > 0) {
    const pr = existing.data[0]!
    await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
      owner: params.owner,
      repo: params.name,
      pull_number: pr.number,
      title: params.title,
      body: params.body,
    })
    return { number: pr.number, headSha, action: "existing" }
  }

  const created = await octokit.request("POST /repos/{owner}/{repo}/pulls", {
    owner: params.owner,
    repo: params.name,
    title: params.title,
    head: TRANSLATION_BRANCH,
    base: params.defaultBranch,
    body: params.body,
  })

  try {
    await octokit.graphql(
      `mutation($id: ID!) {
         enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: SQUASH }) {
           pullRequest { number }
         }
       }`,
      { id: created.data.node_id },
    )
  } catch {
    // Auto-merge may be disabled on the repo or unavailable; PR creation still succeeds.
  }

  return { number: created.data.number, headSha, action: "opened" }
}
