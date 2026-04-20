import crypto from "node:crypto"

/** Verify a GitHub webhook HMAC-SHA256 signature using constant-time compare. */
export function verifySignature(
  body: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false
  const hmac = crypto.createHmac("sha256", secret)
  hmac.update(body)
  const expected = `sha256=${hmac.digest("hex")}`
  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
