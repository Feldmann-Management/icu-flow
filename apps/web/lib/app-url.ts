export function appUrl(): string {
  const url = process.env.APP_URL
  if (!url) {
    throw new Error(
      "APP_URL is not set. Set it to the public URL of this service (e.g. https://icu-flow.example.com).",
    )
  }
  return url.replace(/\/$/, "")
}
