import { describe, expect, it } from "vitest"
import { repairDecisions } from "../src/core/repair.js"
import type { DecisionRecord } from "../src/core/store.js"

const modern = (o: Partial<DecisionRecord> = {}): DecisionRecord => ({
  at: "2026-11-06T12:10:00Z",
  companyId: "c1",
  taskKey: "iss_2",
  agentId: "a1",
  chosen: "m1",
  chosenLabel: "claude-sonnet-5-5 · codex",
  labels: { m1: "claude-sonnet-5-5 · codex", m2: "deepseek-v4.1-flash · codex" },
  skipped: { m2: "model tier 1 is below the tier 2 floor" },
  signals: [],
  tier: 2,
  confidence: 0.82,
  mode: "routed",
  ...o,
})

// A record shaped like the ones written before labels existed.
const legacy = (o: Partial<DecisionRecord> = {}): DecisionRecord =>
  ({
    at: "2026-11-06T12:00:00Z",
    companyId: "c1",
    taskKey: "iss_1",
    agentId: "a1",
    chosen: "m1",
    skipped: { m2: "model tier 1 is below the tier 2 floor" },
    signals: [],
    mode: "routed",
    ...o,
  }) as DecisionRecord

describe("decision repair", () => {
  it("gives a legacy record the label a newer record knows", () => {
    const { decisions, repaired } = repairDecisions([modern(), legacy()])
    expect(repaired).toBe(1)
    expect(decisions[1]!.chosenLabel).toBe("claude-sonnet-5-5 · codex")
  })

  it("fills a label map so skip rows stop showing ids", () => {
    const { decisions } = repairDecisions([modern(), legacy()])
    expect(decisions[1]!.labels?.m2).toBe("deepseek-v4.1-flash · codex")
  })

  it("supplies a neutral tier and confidence, and says they are unknown", () => {
    const { decisions } = repairDecisions([legacy()])
    expect(decisions[0]!.tier).toBe(2)
    expect(decisions[0]!.confidence).toBe(0.5)
    expect(decisions[0]!.note).toContain("before this version tracked")
  })

  it("leaves modern records untouched", () => {
    const input = [modern()]
    const { decisions, repaired } = repairDecisions(input)
    expect(repaired).toBe(0)
    expect(decisions[0]).toBe(input[0])
  })

  it("keeps a real note instead of overwriting it", () => {
    const { decisions } = repairDecisions([legacy({ note: "no member reaches the tier 3 floor" })])
    expect(decisions[0]!.note).toBe("no member reaches the tier 3 floor")
  })

  it("does not guess a label it has never seen", () => {
    const { decisions } = repairDecisions([legacy({ chosen: "m-unknown" })])
    expect(decisions[0]!.chosenLabel).toBeUndefined()
  })
})
