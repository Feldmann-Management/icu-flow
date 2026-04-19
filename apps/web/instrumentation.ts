export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { appUrl } = await import("@/lib/app-url")
  const { hasAppCredentials, syncWebhookUrl } = await import("@workspace/github")

  try {
    if (await hasAppCredentials()) {
      await syncWebhookUrl(appUrl())
      console.log(`[instrumentation] webhook URL synced to ${appUrl()}`)
    }
  } catch (error) {
    console.warn("[instrumentation] failed to sync webhook URL:", error)
  }
}
