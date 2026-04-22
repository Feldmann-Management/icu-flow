import fs from "node:fs/promises"
import path from "node:path"

import { simpleGit, type SimpleGit } from "simple-git"

import { getInstallationToken, installationClient } from "@workspace/github"

export const TRANSLATION_BRANCH = "icu-flow/translations"

export interface CloneParams {
  workdir: string
  installationId: number
  owner: string
  name: string
  defaultBranch: string
}

export async function cloneRepo(params: CloneParams): Promise<SimpleGit> {
  const token = await getInstallationToken(params.installationId)
  const cloneUrl = `https://x-access-token:${token}@github.com/${params.owner}/${params.name}.git`
  const git = simpleGit(params.workdir)
  await git.clone(cloneUrl, ".", [
    "--depth",
    "1",
    "--single-branch",
    "--branch",
    params.defaultBranch,
  ])
  return git
}

export interface CommitParams {
  git: SimpleGit
  workdir: string
  installationId: number
  owner: string
  name: string
  defaultBranch: string
  message: string
}

/**
 * Creates a commit on the translation branch via GitHub's Git Database API
 * (blobs → tree → commit → ref). The commit is authored by the App's bot user,
 * which is what GitHub-native attribution (e.g. Vercel preview deploys) looks
 * for — a locally-authored `git push` does not get the same treatment.
 */
export async function commitAndForcePushTranslations(
  params: CommitParams,
): Promise<{ headSha: string } | null> {
  const { git, workdir, installationId, owner, name, defaultBranch, message } =
    params

  const status = await git.status()
  if (status.files.length === 0) return null

  const added: string[] = []
  const deleted: string[] = []
  for (const file of status.files) {
    if (file.index === "D" || file.working_dir === "D") {
      deleted.push(file.path)
    } else {
      added.push(file.path)
    }
  }

  const octokit = await installationClient(installationId)

  const baseRef = await octokit.request(
    "GET /repos/{owner}/{repo}/git/ref/{ref}",
    { owner, repo: name, ref: `heads/${defaultBranch}` },
  )
  const parentSha = baseRef.data.object.sha

  const treeEntries: Array<{
    path: string
    mode: "100644"
    type: "blob"
    sha: string | null
  }> = []

  for (const file of added) {
    const content = await fs.readFile(path.join(workdir, file))
    const blob = await octokit.request(
      "POST /repos/{owner}/{repo}/git/blobs",
      {
        owner,
        repo: name,
        content: content.toString("base64"),
        encoding: "base64",
      },
    )
    treeEntries.push({
      path: file,
      mode: "100644",
      type: "blob",
      sha: blob.data.sha,
    })
  }

  for (const file of deleted) {
    treeEntries.push({
      path: file,
      mode: "100644",
      type: "blob",
      sha: null,
    })
  }

  const tree = await octokit.request(
    "POST /repos/{owner}/{repo}/git/trees",
    {
      owner,
      repo: name,
      base_tree: parentSha,
      tree: treeEntries,
    },
  )

  const commit = await octokit.request(
    "POST /repos/{owner}/{repo}/git/commits",
    {
      owner,
      repo: name,
      message,
      tree: tree.data.sha,
      parents: [parentSha],
    },
  )

  const commitSha = commit.data.sha
  const branchRef = `heads/${TRANSLATION_BRANCH}`

  let branchExists = true
  try {
    await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
      owner,
      repo: name,
      ref: branchRef,
    })
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      branchExists = false
    } else {
      throw error
    }
  }

  if (branchExists) {
    await octokit.request(
      "PATCH /repos/{owner}/{repo}/git/refs/{ref}",
      {
        owner,
        repo: name,
        ref: branchRef,
        sha: commitSha,
        force: true,
      },
    )
  } else {
    await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
      owner,
      repo: name,
      ref: `refs/heads/${TRANSLATION_BRANCH}`,
      sha: commitSha,
    })
  }

  return { headSha: commitSha }
}
