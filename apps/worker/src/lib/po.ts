import fs from "node:fs/promises"
import path from "node:path"

import { po, type GetTextTranslations } from "gettext-parser"

export type Catalog = GetTextTranslations

export interface PoEntry {
  msgid: string
  msgctxt?: string
  msgstr: string
}

export async function readCatalog(filePath: string): Promise<Catalog | null> {
  try {
    const buf = await fs.readFile(filePath)
    return po.parse(buf)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null
    }
    throw error
  }
}

export async function writeCatalog(filePath: string, catalog: Catalog): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const out = po.compile(catalog)
  await fs.writeFile(filePath, out)
}

/**
 * Iterate all translatable entries (excluding the empty header entry).
 * Emits (context, msgid, entry) so callers can find missing strings.
 */
export function* entries(
  catalog: Catalog,
): Generator<{ context: string; msgid: string; msgstr: string[] }> {
  for (const [context, group] of Object.entries(catalog.translations)) {
    for (const [msgid, entry] of Object.entries(group)) {
      if (context === "" && msgid === "") continue // header
      yield { context, msgid, msgstr: entry.msgstr }
    }
  }
}

/**
 * Given a source catalog and a (possibly empty/missing) target catalog, produce a
 * new target catalog containing every entry from source and the list of entries
 * whose translation is missing.
 */
export function buildTargetFromSource(
  source: Catalog,
  existing: Catalog | null,
  targetLocale: string,
): { catalog: Catalog; missing: { context: string; msgid: string; source: string }[] } {
  const catalog: Catalog = {
    charset: source.charset ?? "utf-8",
    headers: {
      ...(existing?.headers ?? {}),
      Language: targetLocale,
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Transfer-Encoding": "8bit",
      "MIME-Version": "1.0",
    },
    translations: {},
  }

  const missing: { context: string; msgid: string; source: string }[] = []

  for (const [context, group] of Object.entries(source.translations)) {
    const outGroup: Record<string, (typeof group)[string]> = {}
    for (const [msgid, entry] of Object.entries(group)) {
      if (context === "" && msgid === "") continue
      const existingEntry = existing?.translations[context]?.[msgid]
      const existingStr = existingEntry?.msgstr?.[0] ?? ""
      outGroup[msgid] = {
        ...entry,
        msgstr: existingStr ? existingEntry!.msgstr : [""],
      }
      if (!existingStr) {
        missing.push({ context, msgid, source: msgid })
      }
    }
    catalog.translations[context] = outGroup
  }

  return { catalog, missing }
}

/** Fill in translations for the given (context, msgid) pairs. */
export function applyTranslations(
  catalog: Catalog,
  translations: { context: string; msgid: string; translation: string }[],
): void {
  for (const t of translations) {
    const group = catalog.translations[t.context]
    if (!group) continue
    const entry = group[t.msgid]
    if (!entry) continue
    entry.msgstr = [t.translation]
  }
}
