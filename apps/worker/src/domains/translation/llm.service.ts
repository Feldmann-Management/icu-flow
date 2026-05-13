import OpenAI from "openai"

import * as settingsRepo from "../settings/settings.repository"

export interface LlmConfig {
  apiKey: string
  model: string
}

export interface TranslateBatchInput {
  sourceLocale: string
  targetLocale: string
  entries: { key: string; source: string }[]
  generalRules?: string
  targetLocaleRules?: string
}

export interface TranslatedEntry {
  key: string
  translation: string
}

const DEFAULT_MODEL = "gpt-5-mini"
const MAX_KEYS_PER_REQUEST = 50

export async function resolveLlmConfig(): Promise<LlmConfig> {
  const row = await settingsRepo.findOne()
  const apiKey = row?.openaiApiKey ?? process.env.OPENAI_API_KEY ?? ""
  const model = row?.openaiModel ?? DEFAULT_MODEL
  if (!apiKey) {
    throw new Error(
      "No OpenAI API key configured. Set one in the dashboard Settings or OPENAI_API_KEY env.",
    )
  }
  return { apiKey, model }
}

export async function translateBatch(
  config: LlmConfig,
  input: TranslateBatchInput,
): Promise<TranslatedEntry[]> {
  if (input.entries.length === 0) return []

  const client = new OpenAI({ apiKey: config.apiKey })
  const results: TranslatedEntry[] = []
  const systemPrompt = buildSystemPrompt(input)

  for (let i = 0; i < input.entries.length; i += MAX_KEYS_PER_REQUEST) {
    const slice = input.entries.slice(i, i + MAX_KEYS_PER_REQUEST)
    const payload = Object.fromEntries(slice.map((e) => [e.key, e.source]))

    const response = await client.chat.completions.create({
      model: config.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(payload) },
      ],
    })

    const text = response.choices[0]?.message?.content
    if (!text) {
      throw new Error("OpenAI returned empty response")
    }
    const parsed = JSON.parse(text) as Record<string, unknown>
    for (const entry of slice) {
      const translation = parsed[entry.key]
      if (typeof translation === "string") {
        results.push({ key: entry.key, translation })
      }
    }
  }

  return results
}

function buildSystemPrompt(input: TranslateBatchInput): string {
  const parts: string[] = [
    [
      `You translate ICU MessageFormat strings from ${input.sourceLocale} to ${input.targetLocale}.`,
      "Preserve all ICU placeholders like {name}, {count, plural, one {...} other {...}}, <Link>...</Link>, and any punctuation/capitalization pattern that belongs to the target language.",
      "Return a single JSON object. Keys are the input keys; values are the translated strings. Do not add commentary.",
    ].join(" "),
  ]

  const general = input.generalRules?.trim()
  if (general) {
    parts.push(`General style rules (apply to every translation):\n${general}`)
  }

  const locale = input.targetLocaleRules?.trim()
  if (locale) {
    parts.push(`Style rules for ${input.targetLocale}:\n${locale}`)
  }

  return parts.join("\n\n")
}
