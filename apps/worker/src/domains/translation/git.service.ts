import { simpleGit, type SimpleGit } from "simple-git"

import {
  botCommitIdentity,
  getAppCredentials,
  getInstallationToken,
} from "@workspace/github"

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
  const creds = await getAppCredentials()
  const identity = botCommitIdentity(creds)
  await git.addConfig("user.name", identity.name)
  await git.addConfig("user.email", identity.email)
  return git
}

export async function commitAndForcePushTranslations(
  git: SimpleGit,
  message: string,
): Promise<{ headSha: string } | null> {
  await git.add(["-A"])
  const status = await git.status()
  if (status.files.length === 0) {
    return null
  }
  await git.checkoutLocalBranch(TRANSLATION_BRANCH)
  await git.commit(message)
  await git.push("origin", TRANSLATION_BRANCH, ["--force"])
  const headSha = (await git.revparse(["HEAD"])).trim()
  return { headSha }
}
