import fs from "node:fs/promises"
import path from "node:path"

import { parse as parseYaml } from "yaml"

import {
  configSchema,
  ICU_FLOW_CONFIG_PATH,
  type IcuFlowConfig,
} from "@workspace/translation-config"

export { configSchema, resolveLocalePath } from "@workspace/translation-config"
export type { IcuFlowConfig } from "@workspace/translation-config"

export class ConfigMissingError extends Error {
  constructor() {
    super("icu-flow.yml not found at repo root")
    this.name = "ConfigMissingError"
  }
}

export async function readConfig(repoDir: string): Promise<IcuFlowConfig> {
  const configPath = path.join(repoDir, ICU_FLOW_CONFIG_PATH)
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
