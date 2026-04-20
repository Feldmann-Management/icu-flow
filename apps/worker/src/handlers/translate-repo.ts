import type { JobPayload } from "@workspace/queue"

import { runTranslation } from "../domains/translation/translation.service"

export async function translateRepo(
  payload: JobPayload<"translate-repo">,
  jobId: string,
): Promise<void> {
  await runTranslation(payload, jobId)
}
