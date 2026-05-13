import { z } from "zod"

export const ICU_FLOW_CONFIG_PATH = "icu-flow.yml"

export const configSchema = z.object({
  source: z.string().min(1),
  targets: z.array(z.string().min(1)).min(1),
  messages: z.array(z.string().min(1)).min(1),
})

export type IcuFlowConfig = z.infer<typeof configSchema>

export function resolveLocalePath(template: string, locale: string): string {
  return template.replace(/\{locale\}/g, locale)
}
