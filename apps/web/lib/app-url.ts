export function appUrl(): string {
  const url = process.env.APP_URL
  if (!url) {
    // Next's production build phase may import route modules to collect page
    // data; return a placeholder so the build succeeds. The real validation
    // happens at request time when NEXT_PHASE is "phase-production-server".
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return "http://localhost"
    }
    throw new Error(
      "APP_URL is not set. Set it to the public URL of this service (e.g. https://icu-flow.example.com).",
    )
  }
  return url.replace(/\/$/, "")
}
