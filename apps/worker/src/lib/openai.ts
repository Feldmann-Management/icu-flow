import OpenAI from "openai"

export interface TranslateBatchInput {
  sourceLocale: string
  targetLocale: string
  entries: { key: string; source: string }[]
}

export interface TranslatedEntry {
  key: string
  translation: string
}

const MODEL = "gpt-4o-mini"
const MAX_KEYS_PER_REQUEST = 50

export async function translateBatch(
  input: TranslateBatchInput,
): Promise<TranslatedEntry[]> {
  if (input.entries.length === 0) return []
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set")
  }

  const client = new OpenAI()
  const results: TranslatedEntry[] = []

  for (let i = 0; i < input.entries.length; i += MAX_KEYS_PER_REQUEST) {
    const slice = input.entries.slice(i, i + MAX_KEYS_PER_REQUEST)
    const payload = Object.fromEntries(slice.map((e) => [e.key, e.source]))

    const response = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            `You translate ICU MessageFormat strings from ${input.sourceLocale} to ${input.targetLocale}.`,
            "Preserve all ICU placeholders like {name}, {count, plural, one {...} other {...}}, <Link>...</Link>, and any punctuation/capitalization pattern that belongs to the target language.",
            "Return a single JSON object. Keys are the input keys; values are the translated strings. Do not add commentary.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
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
