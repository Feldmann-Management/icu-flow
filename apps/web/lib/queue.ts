import { createQueue, type QueueClient } from "@workspace/queue";

let queuePromise: Promise<QueueClient> | undefined;

export function getQueue(): Promise<QueueClient> {
  queuePromise ??= (async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set");
    }
    return createQueue({ databaseUrl });
  })();
  return queuePromise;
}
