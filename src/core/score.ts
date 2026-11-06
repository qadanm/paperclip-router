import type { TaskClass } from "./classify.js"
import { assessUsage, type MemberUsage } from "./windows.js"

export interface Candidate {
  readonly memberId: string
  /** The effective model for this run: the composer override when present, else the member default. */
  readonly model: string
  readonly provider: string
  readonly usage?: MemberUsage | undefined
}

export interface RankingPolicy {
  /** Lowest model tier allowed for each task tier. 1 is economy, 3 is frontier. */
  readonly floorByTier: Readonly<Record<1 | 2 | 3, number>>
  /** Model name (normalized, lowercase) to capability tier. Unknown names are tier 2. */
  readonly modelTier: Readonly<Record<string, 1 | 2 | 3>>
  /** How strongly window pressure moves the score. 1 is the calibrated default. */
  readonly expiryWeight: number
  /**
   * A member whose weakest observed window is at or above this percentage is
   * skipped when another member can take the task. Optional so older callers and
   * tests keep working; the host always supplies it from config.
   */
  readonly safetyMarginPercent?: number
}

export interface RankingInput {
  readonly task: TaskClass
  readonly candidates: ReadonlyArray<Candidate>
  readonly memberOrder: readonly string[]
  readonly lastMemberId: string | null
  readonly memory: ReadonlySet<string>
  readonly policy: RankingPolicy
  readonly now: Date
}

export interface RankingResult {
  readonly chosen?: string
  /** Why a below-floor member was used, when the floor could not be met. */
  readonly note?: string
  readonly skipped: Record<string, string>
}

export const UNKNOWN_MODEL_TIER = 2

const normalize = (model: string) => model.trim().toLowerCase()

/** Lowest free headroom across observed windows, 0..1. */
const weakestFill = (assessment: ReturnType<typeof assessUsage>): number | undefined => {
  if (assessment.state !== "ok") return undefined
  let weakest: number | undefined
  for (const note of assessment.fills) if (weakest === undefined || note < weakest) weakest = note
  return weakest
}

export const modelTierOf = (model: string, policy: RankingPolicy): number =>
  policy.modelTier[normalize(model)] ?? UNKNOWN_MODEL_TIER

/**
 * Rotate the pool order so ties spread across members instead of pinning work
 * to the first one. Members missing from `memberOrder` keep their candidate
 * order at the end, which only happens if the host's order drifted.
 */
const rotatedOrder = (candidates: ReadonlyArray<Candidate>, memberOrder: readonly string[], lastMemberId: string | null) => {
  const present = candidates.map((candidate) => candidate.memberId)
  const ordered = memberOrder.filter((id) => present.includes(id))
  for (const id of present) if (!ordered.includes(id)) ordered.push(id)
  if (!lastMemberId) return ordered
  const index = ordered.indexOf(lastMemberId)
  if (index < 0) return ordered
  return [...ordered.slice(index + 1), ...ordered.slice(0, index + 1)]
}

/**
 * Rank members for one task. Every rejection carries a plain sentence, because
 * these strings are shown to the person paying for the work. A member below the
 * task's intelligence floor is never a candidate, and a member with no observed
 * usage is treated as neutral rather than healthy or exhausted.
 */
export const rankCandidates = (input: RankingInput): RankingResult => {
  const { task, candidates, lastMemberId, memory, policy, now } = input
  const floor = policy.floorByTier[task.tier]
  const margin = policy.safetyMarginPercent
  const order = rotatedOrder(candidates, input.memberOrder, lastMemberId)
  const skipped: Record<string, string> = {}
  const scored: Array<{ memberId: string; score: number; order: number }> = []
  // The floor is a preference, not a veto: when no member reaches it, the task
  // still needs a model. Remembering the best below-floor member is what keeps
  // an unknown model from deadlocking a pool.
  const belowFloor: Array<{ memberId: string; tier: number; score: number; order: number }> = []

  for (const candidate of candidates) {
    const tier = modelTierOf(candidate.model, policy)
    if (memory.has(candidate.memberId)) {
      skipped[candidate.memberId] = "rejected a request recently, held back for new tasks"
      continue
    }
    const usage = assessUsage(candidate.usage, now)
    if (usage.state === "blocked") {
      skipped[candidate.memberId] = usage.notes.join("; ")
      continue
    }
    // Safety margin: hold back a member that is nearly drained when someone
    // else is observed with more headroom. Never applies when it would leave
    // no usable member, which the floor fallback below also protects.
    const weakest = weakestFill(usage)
    if (margin !== undefined && usage.state === "ok" && weakest !== undefined && weakest * 100 >= margin) {
      const hasRoomier = candidates.some((other) => {
        if (other.memberId === candidate.memberId) return false
        const assessment = assessUsage(other.usage, now)
        if (assessment.state === "blocked" || memory.has(other.memberId)) return false
        const fill = weakestFill(assessment)
        return fill !== undefined && fill * 100 < margin
      })
      if (hasRoomier) {
        skipped[candidate.memberId] = `weakest window at ${Math.round(weakest * 100)}%, past the ${margin}% safety margin`
        continue
      }
    }
    if (tier < floor) {
      // Below-floor members are candidates for the fallback, so they are recorded
      // separately instead of in `skipped`. If a qualifying member exists, this
      // list is rendered as "below the floor" reasons; if none does, the best of
      // them is chosen and the deviation becomes a note on the decision.
      const orderIndex = order.indexOf(candidate.memberId)
      belowFloor.push({ memberId: candidate.memberId, tier, score: (tier - floor) * 2 + (1 - Math.min(1.5, usage.pressure)) * policy.expiryWeight, order: orderIndex < 0 ? order.length : orderIndex })
      continue
    }
    // Higher score wins. Model fit dominates: the closest qualifying tier wins,
    // so a mechanical task does not burn a frontier account just because it can.
    // Ties then go to cheaper windows, then rotate from lastMemberId, because
    // pinning already handles session continuity.
    const tierScore = -(tier - floor) * 2
    const usageScore = (1 - Math.min(1.5, usage.pressure)) * policy.expiryWeight
    const orderIndex = order.indexOf(candidate.memberId)
    scored.push({ memberId: candidate.memberId, score: tierScore + usageScore, order: orderIndex < 0 ? order.length : orderIndex })
  }

  scored.sort((left, right) => right.score - left.score || left.order - right.order)
  const best = scored[0]
  if (best) {
    for (const entry of belowFloor) {
      skipped[entry.memberId] = `model tier ${entry.tier} is below the tier ${floor} floor for ${task.kind} work`
    }
    return { chosen: best.memberId, skipped }
  }
  if (belowFloor.length > 0) {
    // No member reaches the floor: take the best available rather than failing
    // the task. This is a deviation note on the decision, not a skip. The other
    // below-floor members are still explained as passed over.
    const nearest = [...belowFloor].sort((left, right) => right.score - left.score || left.order - right.order)[0]!
    for (const entry of belowFloor) {
      if (entry.memberId === nearest.memberId) continue
      skipped[entry.memberId] = `model tier ${entry.tier} is below the tier ${floor} floor for ${task.kind} work`
    }
    return {
      chosen: nearest.memberId,
      note: `no member reaches the tier ${floor} floor; used the nearest tier ${nearest.tier}`,
      skipped,
    }
  }
  return { skipped }
}
