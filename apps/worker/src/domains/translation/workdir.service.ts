import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

function baseDir(): string {
  return process.env.WORK_DIR ?? path.join(os.tmpdir(), "icu-flow-work")
}

export async function createWorkdir(jobId: string): Promise<string> {
  const base = baseDir()
  await fs.mkdir(base, { recursive: true })
  return fs.mkdtemp(path.join(base, `${jobId}-`))
}

export async function removeWorkdir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true })
}

/** Remove directories older than `maxAgeMs` in WORK_DIR. */
export async function sweepStaleWorkdirs(
  maxAgeMs: number = 2 * 60 * 60 * 1000,
): Promise<void> {
  const base = baseDir()
  let entries: string[]
  try {
    entries = await fs.readdir(base)
  } catch {
    return
  }
  const cutoff = Date.now() - maxAgeMs
  await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(base, entry)
      try {
        const stat = await fs.stat(full)
        if (stat.mtimeMs < cutoff) {
          await fs.rm(full, { recursive: true, force: true })
        }
      } catch {
        // ignore
      }
    }),
  )
}
