import fs from "node:fs/promises"
import path from "node:path"

import { parse as parseYaml } from "yaml"
import { z } from "zod"

export const configSchema = z.object({
  source: z.string().min(1),
  targets: z.array(z.string().min(1)).min(1),
  messages: z.array(z.string().min(1)).min(1),
})

export type IcuFlowConfig = z.infer<typeof configSchema>

export class ConfigMissingError extends Error {
  constructor() {
    super("icu-flow.yml not found at repo root")
    this.name = "ConfigMissingError"
  }
}

export async function readConfig(repoDir: string): Promise<IcuFlowConfig> {
  const configPath = path.join(repoDir, "icu-flow.yml")
  let raw: string
  try {
    raw = await fs.readFile(configPath, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ConfigMissingError()
    }
    throw error
  }
  const parsed = parseYaml(raw) as unknown
  return configSchema.parse(parsed)
}

/**
 * Resolve a messages template like "apps/web/locales/{locale}/messages.po"
 * for the given locale.
 */
export function resolveLocalePath(template: string, locale: string): string {
  return template.replace(/\{locale\}/g, locale)
}
