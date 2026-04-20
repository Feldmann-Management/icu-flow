import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"] });

import { createQueue } from "@workspace/queue";

import { sweepStaleWorkdirs } from "./domains/translation/workdir.service";
import { translateRepo } from "./handlers/translate-repo";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

await sweepStaleWorkdirs();

const queue = await createQueue({ databaseUrl });

await queue.registerHandler("translate-repo", async (payload, job) => {
  await translateRepo(payload, job.id);
});

console.log("[worker] started, waiting for jobs");

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] received ${signal}, draining…`);
  try {
    await queue.stop();
    console.log("[worker] stopped cleanly");
    process.exit(0);
  } catch (error) {
    console.error("[worker] error during shutdown", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
