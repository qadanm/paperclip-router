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
  readonly skipped: Record<string, string>
}

export const UNKNOWN_MODEL_TIER = 2

const normalize = (model: string) => model.trim().toLowerCase()

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
  const order = rotatedOrder(candidates, input.memberOrder, lastMemberId)
  const skipped: Record<string, string> = {}
  const scored: Array<{ memberId: string; score: number; order: number }> = []

  for (const candidate of candidates) {
    const tier = modelTierOf(candidate.model, policy)
    if (tier < floor) {
      skipped[candidate.memberId] = `model tier ${tier} is below the tier ${floor} floor for ${task.kind} work`
      continue
    }
    if (memory.has(candidate.memberId)) {
      skipped[candidate.memberId] = "rejected a request recently, held back for new tasks"
      continue
    }
    const usage = assessUsage(candidate.usage, now)
    if (usage.state === "blocked") {
      skipped[candidate.memberId] = usage.notes.join("; ")
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
  return best ? { chosen: best.memberId, skipped } : { skipped }
}
