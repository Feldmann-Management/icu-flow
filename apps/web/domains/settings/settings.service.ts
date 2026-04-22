import * as repo from "./settings.repository"

export const OPENAI_MODELS = ["gpt-5-nano", "gpt-5-mini", "gpt-5"] as const
export type OpenAIModel = (typeof OPENAI_MODELS)[number]
export const DEFAULT_MODEL: OpenAIModel = "gpt-5-mini"

export interface SettingsView {
  openaiApiKey: string
  openaiModel: OpenAIModel
}

export interface UpsertInput {
  openaiApiKey: string
  openaiModel: OpenAIModel
}

function coerceModel(value: string | null | undefined): OpenAIModel {
  if (value && (OPENAI_MODELS as readonly string[]).includes(value)) {
    return value as OpenAIModel
  }
  return DEFAULT_MODEL
}

export async function get(): Promise<SettingsView> {
  const row = await repo.findOne()
  return {
    openaiApiKey: row?.openaiApiKey ?? "",
    openaiModel: coerceModel(row?.openaiModel),
  }
}

export async function upsert(input: UpsertInput): Promise<void> {
  const key = input.openaiApiKey.trim()
  await repo.upsert({
    openaiApiKey: key.length > 0 ? key : null,
    openaiModel: input.openaiModel,
  })
}

export interface TestKeyResult {
  ok: boolean
  error?: string
}

export async function testKey(providedKey?: string): Promise<TestKeyResult> {
  let key = providedKey?.trim()
  if (!key) {
    const saved = await repo.findOne()
    key = saved?.openaiApiKey ?? undefined
  }
  if (!key) {
    return { ok: false, error: "no key provided or saved" }
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-nano",
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 1,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    let message = `HTTP ${response.status}`
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } }
      if (parsed.error?.message) message = parsed.error.message
    } catch {
      // fall through with HTTP status
    }
    return { ok: false, error: message }
  }

  return { ok: true }
}
