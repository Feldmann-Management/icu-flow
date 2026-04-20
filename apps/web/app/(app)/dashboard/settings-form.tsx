"use client"

import { useForm } from "@tanstack/react-form"
import { useState } from "react"
import { z } from "zod"

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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

const MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1"] as const

const schema = z.object({
  openaiApiKey: z.string(),
  openaiModel: z.enum(MODELS),
})

export interface SettingsFormProps {
  initial: {
    openaiApiKeyLastFour: string | null
    openaiModel: (typeof MODELS)[number]
  }
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const [testState, setTestState] = useState<
    { status: "idle" | "running" | "ok" | "error"; message?: string }
  >({ status: "idle" })
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  )

  const form = useForm({
    defaultValues: {
      openaiApiKey: "",
      openaiModel: initial.openaiModel,
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setSaveState("saving")
      const result = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: value.openaiApiKey,
          openaiModel: value.openaiModel,
        }),
      })
      setSaveState(result.ok ? "saved" : "error")
      if (result.ok) form.reset({ ...form.state.values, openaiApiKey: "" })
    },
  })

  async function handleTest(key: string): Promise<void> {
    setTestState({ status: "running" })
    const res = await fetch("/api/settings/test-openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: key }),
    })
    const json = (await res.json()) as { ok: boolean; error?: string }
    setTestState(
      json.ok
        ? { status: "ok", message: "Key works" }
        : { status: "error", message: json.error ?? "Test failed" },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          OpenAI configuration used by the worker to translate messages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSaveState("idle")
            setTestState({ status: "idle" })
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field name="openaiApiKey">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>OpenAI API key</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
                      autoComplete="off"
                      placeholder={
                        initial.openaiApiKeyLastFour
                          ? `•••• •••• •••• ${initial.openaiApiKeyLastFour} (leave blank to keep)`
                          : "sk-..."
                      }
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={testState.status === "running"}
                      onClick={() => handleTest(field.state.value)}
                    >
                      {testState.status === "running" ? "Testing…" : "Test"}
                    </Button>
                  </div>
                  <FieldDescription>
                    {testState.status === "ok" && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {testState.message}
                      </span>
                    )}
                    {testState.status === "error" && (
                      <span className="text-destructive">{testState.message}</span>
                    )}
                    {testState.status === "idle" &&
                      "The worker uses this key to translate catalogs."}
                    {testState.status === "running" && "Contacting OpenAI…"}
                  </FieldDescription>
                </Field>
              )}
            </form.Field>

            <form.Field name="openaiModel">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Model</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as (typeof MODELS)[number])}
                  >
                    <SelectTrigger id={field.name}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    <code>gpt-4o-mini</code> is cheapest; <code>gpt-4o</code> and{" "}
                    <code>gpt-4.1</code> give better prose quality.
                  </FieldDescription>
                </Field>
              )}
            </form.Field>

            {saveState === "error" && (
              <Field data-invalid>
                <FieldError>Save failed — check the server log.</FieldError>
              </Field>
            )}

            <Field>
              <form.Subscribe
                selector={(s) => [s.canSubmit, s.isSubmitting] as const}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    disabled={!canSubmit || isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting
                      ? "Saving…"
                      : saveState === "saved"
                        ? "Saved ✓"
                        : "Save"}
                  </Button>
                )}
              </form.Subscribe>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
