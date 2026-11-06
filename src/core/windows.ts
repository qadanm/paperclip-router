/**
 * Allowance windows as Paperclip reports them, reduced to what routing needs.
 *
 * The host attaches these observations per candidate connection. They are
 * provider statements, not our estimates, so the only correct answers here are
 * "observed", "unknown", or "observed and blocked". Never turn a missing or
 * stale observation into a healthy account, and never into an exhausted one:
 * the first burns allowance the user paid for, the second deadlocks a company.
 */

export interface WindowUsage {
  readonly id: string
  readonly label: string
  readonly scope: string | null
  readonly windowSeconds: number | null
  readonly resetsAt: string | null
  readonly usedPercent: number | null
  readonly remainingPercent: number | null
  readonly limitReached: boolean | null
  /** Present only when the provider states admission explicitly. */
  readonly allowed?: boolean | null
}

export interface MemberUsage {
  readonly status: "ok" | "unsupported" | "unavailable" | "error"
  readonly checkedAt: string
  readonly limits: ReadonlyArray<WindowUsage>
}

export type UsageState = "unknown" | "ok" | "blocked"

export interface UsageAssessment {
  readonly state: UsageState
  /** 0..1.5 relative cost proxy. 1 is neutral. Lower means cheaper to spend. */
  readonly pressure: number
  /** Fill fraction per observed window, 0..1. Used by the safety margin. */
  readonly fills: readonly number[]
  readonly notes: string[]
}

/** An observation older than this is not evidence of anything. */
const STALE_MS = 15 * 60_000

const fillOf = (w: WindowUsage): number | null => {
  if (w.usedPercent !== null) return Math.max(0, Math.min(1, w.usedPercent / 100))
  if (w.remainingPercent !== null) return Math.max(0, Math.min(1, 1 - w.remainingPercent / 100))
  return null
}

export const assessUsage = (usage: MemberUsage | undefined, now: Date): UsageAssessment => {
  if (!usage) return { state: "unknown", pressure: 1, fills: [], notes: ["usage was not observed"] }
  if (usage.status !== "ok") {
    return { state: "unknown", pressure: 1, fills: [], notes: [`usage is ${usage.status}`] }
  }
  const observedAt = Date.parse(usage.checkedAt)
  if (!Number.isFinite(observedAt) || now.getTime() - observedAt > STALE_MS) {
    return { state: "unknown", pressure: 1, fills: [], notes: ["usage observation is stale"] }
  }
  const observed = usage.limits.filter((w) => fillOf(w) !== null || w.limitReached === true || w.allowed === false)
  if (observed.length === 0) return { state: "unknown", pressure: 1, fills: [], notes: ["usage reported no windows"] }

  const blocked = observed.filter((w) => w.limitReached === true || w.allowed === false)
  if (blocked.length > 0) {
    return {
      state: "blocked",
      pressure: 1.5,
      fills: blocked.map(() => 1),
      notes: blocked.map((w) => `${w.label} limit reached`),
    }
  }

  const notes: string[] = []
  const fills: number[] = []
  let total = 0
  for (const w of observed) {
    const fill = fillOf(w) ?? 0.5
    // Proximity: allowance that resets soon is cheap to spend because the
    // alternative is losing it. Allowance that resets late costs full price.
    const resetAt = w.resetsAt ? Date.parse(w.resetsAt) : Number.NaN
    const windowMs = w.windowSeconds && w.windowSeconds > 0 ? w.windowSeconds * 1000 : null
    let proximity = 1
    if (Number.isFinite(resetAt) && windowMs) {
      const untilReset = Math.max(0, resetAt - now.getTime())
      proximity = Math.max(0.25, Math.min(1.5, untilReset / windowMs))
    }
    total += fill * proximity
    fills.push(fill)
    const pct = Math.round(fill * 100)
    if (Number.isFinite(resetAt) && resetAt > now.getTime()) {
      const hours = Math.round((resetAt - now.getTime()) / 3_600_000)
      notes.push(`${w.label} ${pct}% used, resets in ${hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`}`)
    } else {
      notes.push(`${w.label} ${pct}% used`)
    }
  }
  return { state: "ok", pressure: total / observed.length, fills, notes }
}

/**
 * The soonest future reset among the windows that are actually blocking. A
 * member is blocked by one window, and waking on a different window's reset
 * would re-attempt into the same cap.
 */
export const earliestReset = (usages: ReadonlyArray<MemberUsage | undefined>, now: Date): Date | undefined => {
  let earliest: number | undefined
  for (const usage of usages) {
    if (!usage || usage.status !== "ok") continue
    for (const w of usage.limits) {
      const blocking = w.limitReached === true || w.allowed === false
      if (!blocking || !w.resetsAt) continue
      const at = Date.parse(w.resetsAt)
      if (!Number.isFinite(at) || at <= now.getTime()) continue
      if (earliest === undefined || at < earliest) earliest = at
    }
  }
  return earliest === undefined ? undefined : new Date(earliest)
}
