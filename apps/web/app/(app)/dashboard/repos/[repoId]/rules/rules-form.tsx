"use client"

import { useForm } from "@tanstack/react-form"
import { Loader2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Textarea } from "@workspace/ui/components/textarea"

import type { RulesView } from "@/domains/repo-translation-rules/repo-translation-rules.service"

export interface RulesFormProps {
  repoId: string
  initial: RulesView
  targets: string[]
  configError: string | null
}

export function RulesForm({
  repoId,
  initial,
  targets,
  configError,
}: RulesFormProps) {
  const [enforcing, setEnforcing] = useState<string | null>(null)

  async function handleEnforce(locale: string): Promise<void> {
    setEnforcing(locale)
    try {
      const res = await fetch(`/api/repos/${repoId}/enforce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locales: [locale] }),
      })
      if (res.ok) {
        toast.success(`Queued re-translation of ${locale}`)
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(body.error ?? "Failed to queue")
      }
    } finally {
      setEnforcing(null)
    }
  }


  // Pre-seed the form with one slot per target so the textareas render even
  // for locales that don't have stored rules yet.
  const seededLanguageRules: Record<string, string> = {}
  for (const locale of targets) {
    seededLanguageRules[locale] = initial.languageRules[locale] ?? ""
  }

  const form = useForm({
    defaultValues: {
      generalRules: initial.generalRules,
      languageRules: seededLanguageRules,
    },
    onSubmit: async ({ value }) => {
      const result = await fetch(`/api/repos/${repoId}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      })
      if (result.ok) {
        toast.success("Rules saved")
        form.reset(value)
      } else {
        toast.error("Save failed — check the server log.")
      }
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      className="flex flex-col gap-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>General rules</CardTitle>
          <CardDescription>
            Applied to every target language. Markdown is supported — these
            instructions are injected into the translator system prompt as-is.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <form.Field name="generalRules">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name} className="sr-only">
                    General rules
                  </FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    rows={8}
                    placeholder="e.g. Prefer casual language over professional."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className="font-mono text-sm"
                  />
                </Field>
              )}
            </form.Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-language rules</CardTitle>
          <CardDescription>
            One block per target locale from <code>icu-flow.yml</code>. Use it
            for terminology, formality, or any locale-specific conventions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configError ? (
            <p className="text-sm text-muted-foreground">{configError}</p>
          ) : targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No target locales configured.
            </p>
          ) : (
            <FieldGroup>
              {targets.map((locale) => (
                <form.Field key={locale} name={`languageRules.${locale}`}>
                  {(field) => (
                    <Field>
                      <div className="flex items-center justify-between">
                        <FieldLabel htmlFor={field.name}>{locale}</FieldLabel>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={enforcing !== null}
                          onClick={() => void handleEnforce(locale)}
                        >
                          {enforcing === locale && (
                            <Loader2Icon className="animate-spin" />
                          )}
                          {enforcing === locale
                            ? "Queuing…"
                            : "Re-translate all keys"}
                        </Button>
                      </div>
                      <Textarea
                        id={field.name}
                        name={field.name}
                        rows={6}
                        placeholder={examplePlaceholder(locale)}
                        value={(field.state.value as string) ?? ""}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        className="font-mono text-sm"
                      />
                      <FieldDescription>
                        Markdown · injected only when translating into{" "}
                        <code>{locale}</code>. Use the button above to re-run
                        translations for every existing key with the current
                        rules (opens or updates the translation PR).
                      </FieldDescription>
                    </Field>
                  )}
                </form.Field>
              ))}
            </FieldGroup>
          )}
        </CardContent>
      </Card>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="w-full"
          >
            {isSubmitting && <Loader2Icon className="animate-spin" />}
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}

function examplePlaceholder(locale: string): string {
  if (locale.startsWith("de")) {
    return 'e.g. Use "Du", not "Sie". Prefer "Konto" over "Account".'
  }
  return "e.g. terminology preferences, formality, etc."
}
