import type { FailureClass } from "./store.js"

/**
 * How a failed run is read for routing purposes.
 *
 * Paperclip's run failure event carries a free-text message and a coarse code,
 * not a structured provider category. These patterns are deliberately narrow so
 * a false "deterministic" cannot strand a healthy account; when Paperclip
 * exposes a structured category to plugins, replace the bodies here and nothing
 * else needs to change.
 */
const deterministicPatterns: ReadonlyArray<RegExp> = [
  /invalid[_ ]?request/i,
  /invalid discriminator/i,
  /expected 'user' \| 'assistant'/i,
  /unsupported (?:parameter|content|role|image)/i,
  /messages\[\d+\]\.role/i,
  /schema (?:validation|mismatch)/i,
  /malformed request/i,
]

const rateLimitPatterns: ReadonlyArray<RegExp> = [
  /\b429\b/,
  /rate[_ ]?limit/i,
  /too many requests/i,
]

const outagePatterns: ReadonlyArray<RegExp> = [
  /\b50[234]\b/,
  /bad gateway/i,
  /service unavailable/i,
  /gateway timeout/i,
  /upstream (?:connect|error|failure)/i,
  /overloaded/i,
  /econnreset|econnrefused|socket hang up/i,
]

export const classifyRunError = (input: { error?: string | null | undefined; errorCode?: string | null | undefined }): FailureClass => {
  const text = `${input.error ?? ""} ${input.errorCode ?? ""}`.trim()
  if (!text) return "other"
  if (deterministicPatterns.some((pattern) => pattern.test(text))) return "deterministic"
  if (rateLimitPatterns.some((pattern) => pattern.test(text))) return "rate_limit"
  if (outagePatterns.some((pattern) => pattern.test(text))) return "outage"
  return "other"
}
