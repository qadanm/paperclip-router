import type { DecisionRecord, FailureRecord } from "./store.js"
import { activeFailures } from "./store.js"

/**
 * Member state for the page.
 *
 * A decision record tells you what happened once. This tells you the standing of
 * each pool member right now: which ones the router is willing to use, which are
 * benched after a rejection, and why. It is derived, never stored, so it cannot
 * drift from the data that produced it.
 */

export interface MemberState {
  /** The host's member id. Kept for correlation, never shown as the primary label. */
  readonly memberId: string
  /** "model · provider", the name a person recognises. */
  readonly label: string
  /** Times this member was chosen in the retained history. */
  readonly chosenCount: number
  /** Last time this member served a decision. */
  readonly lastChosenAt?: string | undefined
  /** Benched from new tasks right now. */
  readonly benched: boolean
  /** Why, and until when, when benched. */
  readonly benchReason?: string | undefined
  readonly benchedUntil?: string | undefined
}

const labelFrom = (decisions: ReadonlyArray<DecisionRecord>, memberId: string): string => {
  for (const decision of decisions) {
    const label = decision.labels?.[memberId]
    if (label) return label
    if (decision.chosen === memberId && decision.chosenLabel) return decision.chosenLabel
  }
  return memberId
}

/**
 * Fold the retained decisions and failure records into per-member state.
 *
 * A member appears once it has either served a decision or been benched. The two
 * are unioned because a benched member that never served one in the retained
 * window is still the most interesting row on the page.
 */
export const memberStates = (input: {
  decisions: ReadonlyArray<DecisionRecord>
  failures: ReadonlyArray<FailureRecord>
  now: Date
  memoryMinutes: number
  /** Members the pool currently offers, when the caller knows them. */
  poolMembers?: ReadonlyArray<{ memberId: string; label?: string | undefined }>
}): MemberState[] => {
  const { decisions, failures, now, memoryMinutes } = input
  const benched = activeFailures(failures, now, memoryMinutes)
  const ids = new Set<string>()
  const chosenCounts = new Map<string, number>()
  const lastChosen = new Map<string, string>()

  for (const decision of decisions) {
    if (!decision.chosen) continue
    ids.add(decision.chosen)
    chosenCounts.set(decision.chosen, (chosenCounts.get(decision.chosen) ?? 0) + 1)
    if (!lastChosen.has(decision.chosen)) lastChosen.set(decision.chosen, decision.at)
  }
  for (const record of failures) {
    // Only deterministic records can bench, so only those are worth a row.
    if (record.class !== "deterministic") continue
    ids.add(record.memberId)
  }
  for (const member of input.poolMembers ?? []) ids.add(member.memberId)
  // Every member the history has ever labelled is a member worth showing, even if
  // it has never won. Otherwise the table hides exactly the members a person wants
  // to ask about ("why is my cheap account never picked?").
  for (const decision of decisions) {
    for (const memberId of Object.keys(decision.labels ?? {})) ids.add(memberId)
  }

  const expiry = new Map<string, string>()
  for (const record of failures) {
    if (record.class !== "deterministic") continue
    const at = Date.parse(record.at)
    if (!Number.isFinite(at)) continue
    const until = new Date(at + memoryMinutes * 60_000).toISOString()
    const existing = expiry.get(record.memberId)
    if (!existing || Date.parse(until) > Date.parse(existing)) expiry.set(record.memberId, until)
  }

  return [...ids]
    .map((memberId): MemberState => {
      const poolLabel = input.poolMembers?.find((member) => member.memberId === memberId)?.label
      const isBenched = benched.has(memberId)
      const until = expiry.get(memberId)
      return {
        memberId,
        label: poolLabel ?? labelFrom(decisions, memberId),
        chosenCount: chosenCounts.get(memberId) ?? 0,
        ...(lastChosen.has(memberId) ? { lastChosenAt: lastChosen.get(memberId) } : {}),
        benched: isBenched,
        ...(isBenched
          ? {
              benchReason: "rejected a request deterministically, held back for new tasks",
              ...(until ? { benchedUntil: until } : {}),
            }
          : {}),
      }
    })
    .sort((left, right) => {
      // Benched members first: they are the actionable rows.
      if (left.benched !== right.benched) return left.benched ? -1 : 1
      return (Date.parse(right.lastChosenAt ?? "") || 0) - (Date.parse(left.lastChosenAt ?? "") || 0)
    })
}
