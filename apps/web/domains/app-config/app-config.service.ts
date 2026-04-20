import crypto from "node:crypto"

import { anonClient } from "@workspace/github"

import { appUrl } from "@/lib/app-url"

import * as repo from "./app-config.repository"

const OWNER_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,38}[a-zA-Z0-9])?$/

export async function hasCredentials(): Promise<boolean> {
  return repo.exists()
}

export interface ManifestForm {
  createUrl: string
  manifestJson: string
  state: string
}

export class InvalidOwnerError extends Error {
  constructor() {
    super("invalid_owner")
    this.name = "InvalidOwnerError"
  }
}

export function buildManifestForm(owner: string): ManifestForm {
  const trimmed = owner.trim()
  if (trimmed && !OWNER_RE.test(trimmed)) {
    throw new InvalidOwnerError()
  }

  const base = appUrl()
  const state = crypto.randomBytes(16).toString("hex")

  const manifest = {
    name: "ICU Flow",
    url: base,
    hook_attributes: {
      url: `${base}/api/webhooks/github`,
    },
    redirect_url: `${base}/api/github/setup/callback`,
    callback_urls: [`${base}/api/github/install/callback`],
    setup_url: `${base}/api/github/install/callback`,
    setup_on_update: true,
    public: false,
    default_permissions: {
      contents: "write",
      pull_requests: "write",
      metadata: "read",
    },
    default_events: ["push"],
  }

  const createUrl = trimmed
    ? `https://github.com/organizations/${encodeURIComponent(trimmed)}/settings/apps/new?state=${state}`
    : `https://github.com/settings/apps/new?state=${state}`

  return {
    createUrl,
    manifestJson: JSON.stringify(manifest),
    state,
  }
}

interface ConversionResponse {
  id: number
  slug: string
  client_id: string
  client_secret: string
  webhook_secret: string
  pem: string
}

export type CompleteManifestResult =
  | { ok: true }
  | { ok: false; error: "missing_code" | "bad_state" }

export async function completeManifest(
  code: string | null,
  state: string | null,
  expectedState: string | undefined,
): Promise<CompleteManifestResult> {
  if (!code) return { ok: false, error: "missing_code" }
  if (!state || !expectedState || state !== expectedState) {
    return { ok: false, error: "bad_state" }
  }

  const anon = anonClient()
  const { data } = await anon.request(
    "POST /app-manifests/{code}/conversions",
    { code },
  )
  const conversion = data as unknown as ConversionResponse

  await repo.insertDefault({
    githubAppId: conversion.id,
    githubAppSlug: conversion.slug,
    githubAppClientId: conversion.client_id,
    githubAppClientSecret: conversion.client_secret,
    githubAppWebhookSecret: conversion.webhook_secret,
    githubAppPrivateKey: conversion.pem,
  })
  return { ok: true }
}
