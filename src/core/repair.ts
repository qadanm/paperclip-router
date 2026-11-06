import type { DecisionRecord } from "./store.js"

/**
 * Repair what older records are missing, at read time.
 *
 * Decisions recorded before the label change carry only member ids, so the page
 * would show `22222222-2222-4222-…` for them. The member ids are still the same
 * ids, and newer records know the labels, so the fix is a lookup: build the id to
 * label map from the newest record that has it, then apply it backwards. Nothing
 * is rewritten in storage; a stale plugin version and a current one read the same
 * data and agree.
 *
 * The same pass fills `tier` and `confidence` on records from versions that did
 * not write them, with a neutral value and the explicit note that it is unknown.
 * A neutral default is honest; inventing a confident one would not be.
 */
export interface RepairResult {
  readonly decisions: DecisionRecord[]
  /** How many rows were enriched. Reported so the page can say so once. */
  readonly repaired: number
}

const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const repairDecisions = (decisions: ReadonlyArray<DecisionRecord>): RepairResult => {
  // Newest first, so the first label seen for an id is the most recent one.
  const labels = new Map<string, string>()
  for (const decision of decisions) {
    if (decision.labels) {
      for (const [memberId, label] of Object.entries(decision.labels)) {
        if (!labels.has(memberId)) labels.set(memberId, label)
      }
    }
    if (decision.chosen && decision.chosenLabel && !labels.has(decision.chosen)) {
      labels.set(decision.chosen, decision.chosenLabel)
    }
  }

  let repaired = 0
  const next = decisions.map((decision) => {
    const missingLabel = Boolean(decision.chosen) && !decision.chosenLabel
    const missingTier = typeof decision.tier !== "number"
    const missingConfidence = typeof decision.confidence !== "number"
    const hasUuidSkip = Object.keys(decision.skipped ?? {}).some((memberId) => uuidLike.test(memberId) && labels.has(memberId))
    if (!missingLabel && !missingTier && !missingConfidence && !hasUuidSkip) return decision

    repaired += 1
    const label = decision.chosen ? labels.get(decision.chosen) : undefined
    return {
      ...decision,
      ...(label && !decision.chosenLabel ? { chosenLabel: label } : {}),
      labels: { ...Object.fromEntries(labels), ...(decision.labels ?? {}) },
      tier: missingTier ? 2 : decision.tier,
      confidence: missingConfidence ? 0.5 : decision.confidence,
      ...(missingTier || missingConfidence
        ? { note: decision.note ?? "recorded before this version tracked tier confidence" }
        : {}),
    } as DecisionRecord
  })

  return { decisions: next, repaired }
}
