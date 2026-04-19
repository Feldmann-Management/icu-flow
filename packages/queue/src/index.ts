import PgBoss from "pg-boss";

import { jobSchemas, type JobName, type JobPayload } from "./jobs";

export type { JobName, JobPayload } from "./jobs";
export { jobSchemas } from "./jobs";

export interface QueueClient {
  enqueue: <N extends JobName>(
    name: N,
    payload: JobPayload<N>,
    options?: PgBoss.SendOptions,
  ) => Promise<string | null>;
  registerHandler: <N extends JobName>(
    name: N,
    handler: (payload: JobPayload<N>, job: PgBoss.Job) => Promise<void>,
    options?: PgBoss.WorkOptions,
  ) => Promise<void>;
  stop: () => Promise<void>;
  boss: PgBoss;
}

export interface QueueConfig {
  databaseUrl: string;
  schema?: string;
}

export async function createQueue(config: QueueConfig): Promise<QueueClient> {
  const boss = new PgBoss({
    connectionString: config.databaseUrl,
    schema: config.schema ?? "pgboss",
  });

  boss.on("error", (error: unknown) => {
    // pg-boss emits errors asynchronously; surface to the host process logger.
    console.error("[queue] pg-boss error", error);
  });

  await boss.start();

  for (const name of Object.keys(jobSchemas) as JobName[]) {
    await boss.createQueue(name);
  }

  return {
    boss,
    async enqueue(name, payload, options) {
      const parsed = jobSchemas[name].parse(payload);
      return boss.send(name, parsed, options ?? {});
    },
    async registerHandler(name, handler, options) {
      await boss.work(name, options ?? {}, async (jobs: PgBoss.Job[]) => {
        for (const job of jobs) {
          const parsed = jobSchemas[name].parse(job.data);
          await handler(parsed as JobPayload<typeof name>, job);
        }
      });
    },
    async stop() {
      await boss.stop({ graceful: true, timeout: 30_000, close: true });
    },
  };
}
