import type { JobPayload } from "@workspace/queue";

export async function translateRepo(payload: JobPayload<"translate-repo">): Promise<void> {
  console.log("[translate-repo] received", {
    installationId: payload.installationId,
    repoFullName: payload.repoFullName,
    sha: payload.sha,
    reason: payload.reason,
  });

  // TODO: mint installation token, shallow clone into a temp dir, translate missing keys,
  // commit + push to icu-flow/translations branch, open/update PR, clean up temp dir.
}
