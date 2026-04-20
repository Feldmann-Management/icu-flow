"use client"

import { useForm } from "@tanstack/react-form"
import { Loader2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
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
    openaiApiKey: string
    openaiModel: (typeof MODELS)[number]
  }
}

type TestState =
  | { status: "idle" | "running" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string }

export function SettingsForm({ initial }: SettingsFormProps) {
  const [testState, setTestState] = useState<TestState>({ status: "idle" })
  const [showKey, setShowKey] = useState(false)

  const form = useForm({
    defaultValues: {
      openaiApiKey: initial.openaiApiKey,
      openaiModel: initial.openaiModel,
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const result = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      })
      if (result.ok) {
        toast.success("Settings saved")
        form.reset(value)
      } else {
        toast.error("Save failed — check the server log.")
      }
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
            setTestState({ status: "idle" })
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field name="openaiApiKey">
              {(field) => {
                const fieldErrors = field.state.meta.errors
                const keyInvalid =
                  fieldErrors.length > 0 || testState.status === "error"
                return (
                  <Field data-invalid={keyInvalid || undefined}>
                    <FieldLabel htmlFor={field.name}>OpenAI API key</FieldLabel>
                    <div className="flex gap-2">
                      <InputGroup>
                        <InputGroupInput
                          id={field.name}
                          name={field.name}
                          type={showKey ? "text" : "password"}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="sk-..."
                          aria-invalid={keyInvalid || undefined}
                          value={field.state.value}
                          onChange={(e) => {
                            field.handleChange(e.target.value)
                            if (testState.status !== "idle") {
                              setTestState({ status: "idle" })
                            }
                          }}
                          onBlur={field.handleBlur}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            onClick={() => setShowKey((v) => !v)}
                            aria-label={showKey ? "Hide key" : "Show key"}
                          >
                            {showKey ? "Hide" : "Show"}
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          testState.status === "running" ||
                          field.state.value.trim().length === 0
                        }
                        onClick={() => handleTest(field.state.value)}
                      >
                        {testState.status === "running" ? "Testing…" : "Test"}
                      </Button>
                    </div>
                    {testState.status === "ok" && (
                      <FieldDescription className="text-emerald-600 dark:text-emerald-400">
                        {testState.message}
                      </FieldDescription>
                    )}
                    {testState.status === "running" && (
                      <FieldDescription>Contacting OpenAI…</FieldDescription>
                    )}
                    {testState.status === "idle" && fieldErrors.length === 0 && (
                      <FieldDescription>
                        The worker uses this key to translate catalogs.
                      </FieldDescription>
                    )}
                    {testState.status === "error" && (
                      <FieldError>{testState.message}</FieldError>
                    )}
                    {fieldErrors.length > 0 && (
                      <FieldError
                        errors={fieldErrors.map((e) => ({
                          message: typeof e === "string" ? e : e?.message,
                        }))}
                      />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="openaiModel">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Model</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) =>
                      field.handleChange(v as (typeof MODELS)[number])
                    }
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
                    <code>gpt-4o-mini</code> is cheapest; <code>gpt-4o</code>{" "}
                    and <code>gpt-4.1</code> give better prose quality.
                  </FieldDescription>
                </Field>
              )}
            </form.Field>

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
                    {isSubmitting && <Loader2Icon className="animate-spin" />}
                    {isSubmitting ? "Saving…" : "Save"}
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
