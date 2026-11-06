/**
 * Plugin state shapes and pure helpers.
 *
 * Paperclip's plugin state has get/set/delete and no list, so history lives in
 * one bounded ring per company. The ring is read and written outside the route
 * hook; the route path only reads the already-materialized set.
 */

export interface DecisionRecord {
  /** ISO timestamp of the decision. */
  readonly at: string
  readonly companyId: string
  /** The host's opaque task correlation key, exactly as received. */
  readonly taskKey: string
  readonly agentId: string
  readonly chosen: string | null
  readonly skipped: Record<string, string>
  readonly signals: readonly string[]
  /** "dry-run" decisions are recorded but the host's reference rotation is used. */
  readonly mode: "routed" | "dry-run"
}

export type FailureClass = "deterministic" | "outage" | "rate_limit" | "other"

export interface FailureRecord {
  readonly memberId: string
  readonly at: string
  readonly taskKey: string
  readonly class: FailureClass
}

export const DECISION_CAP = 200

/** Newest first, bounded. Pure. */
export const pushDecision = (
  ring: ReadonlyArray<DecisionRecord>,
  entry: DecisionRecord,
  cap: number = DECISION_CAP,
): DecisionRecord[] => [entry, ...ring].slice(0, Math.max(0, cap))

/**
 * Members held back from new tasks. Only deterministic rejections count: an
 * outage or a rate limit says nothing about the request shape, and blaming the
 * member for either would strand a healthy account.
 */
export const activeFailures = (
  records: ReadonlyArray<FailureRecord>,
  now: Date,
  ttlMinutes: number,
): ReadonlySet<string> => {
  const cutoff = now.getTime() - ttlMinutes * 60_000
  const active = new Set<string>()
  for (const record of records) {
    if (record.class !== "deterministic") continue
    const at = Date.parse(record.at)
    if (!Number.isFinite(at) || at < cutoff) continue
    active.add(record.memberId)
  }
  return active
}

export const failureKey = (companyId: string, taskKey: string, memberId: string) =>
  `${companyId}\u0000${taskKey}\u0000${memberId}`

/** State keys are company partitioned, because a worker serves many companies. */
export const decisionsKey = (companyId: string) => `decisions:${companyId}`
export const failuresKey = (companyId: string) => `failures:${companyId}`
