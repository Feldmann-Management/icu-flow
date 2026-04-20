export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { appUrl } = await import("@/lib/app-url")
  const { hasCredentials } = await import(
    "@/domains/app-config/app-config.service"
  )
  const { syncWebhookUrl } = await import("@workspace/github")

  try {
    if (await hasCredentials()) {
      await syncWebhookUrl(appUrl())
      console.log(`[instrumentation] webhook URL synced to ${appUrl()}`)
    }
  } catch (error) {
    console.warn("[instrumentation] failed to sync webhook URL:", error)
  }
}
