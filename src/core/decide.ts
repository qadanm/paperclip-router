import type { TaskClass } from "./classify.js"
import { rankCandidates, type Candidate, type RankingPolicy } from "./score.js"
import { assessUsage, earliestReset } from "./windows.js"

/**
 * The full routing decision, pure and host-free.
 *
 * Contract, in order of importance:
 * - A pinned task always keeps its member. The host pinned it so the session
 *   stays continuous; this function cannot improve on that, and returning a
 *   different member would be rejected anyway.
 * - Every rejection carries a plain sentence for the decision page.
 * - Missing usage is unknown, never "healthy" and never "exhausted".
 * - `exhausted` is only returned when every candidate's usage was observed and
 *   blocked, so the host's wait-and-resume cannot be triggered by our blind
 *   spots.
 */
export interface RouteRequest {
  readonly pinnedMemberId?: string | undefined
  readonly candidates: ReadonlyArray<Candidate>
  readonly memberOrder: readonly string[]
  readonly lastMemberId: string | null
}

export type RouteResult =
  | { kind: "selected"; memberId: string; skipped: Record<string, string> }
  | { kind: "exhausted"; retryAt: string; skipped: Record<string, string> }
  | { kind: "unavailable"; skipped: Record<string, string> }

export interface DecideInput {
  readonly request: RouteRequest
  readonly task: TaskClass
  readonly memory: ReadonlySet<string>
  readonly policy: RankingPolicy
  readonly now: Date
}

const DEFAULT_WAIT_MS = 15 * 60_000

export const decideRoute = (input: DecideInput): RouteResult => {
  const { request, task, memory, policy, now } = input
  try {
    if (request.pinnedMemberId) {
      return { kind: "selected", memberId: request.pinnedMemberId, skipped: {} }
    }
    if (request.candidates.length === 0) {
      return { kind: "unavailable", skipped: {} }
    }

    const ranked = rankCandidates({
      task,
      candidates: request.candidates,
      memberOrder: request.memberOrder,
      lastMemberId: request.lastMemberId,
      memory,
      policy,
      now,
    })
    if (ranked.chosen) {
      return { kind: "selected", memberId: ranked.chosen, skipped: ranked.skipped }
    }

    const allBlocked = request.candidates.every(
      (candidate) => assessUsage(candidate.usage, now).state === "blocked",
    )
    if (!allBlocked) return { kind: "unavailable", skipped: ranked.skipped }

    const reset = earliestReset(request.candidates.map((candidate) => candidate.usage), now)
    return {
      kind: "exhausted",
      retryAt: (reset ?? new Date(now.getTime() + DEFAULT_WAIT_MS)).toISOString(),
      skipped: ranked.skipped,
    }
  } catch {
    // The route hook must never fail a run. A valid member beats a blocked task.
    const fallback = request.pinnedMemberId ?? request.candidates[0]?.memberId
    return fallback ? { kind: "selected", memberId: fallback, skipped: {} } : { kind: "unavailable", skipped: {} }
  }
}
