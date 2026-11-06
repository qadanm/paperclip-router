import { describe, expect, it } from "vitest"
import { activeFailures, pushDecision, type DecisionRecord, type FailureRecord } from "../src/core/store.js"

const decision = (at: string): DecisionRecord => ({
  at,
  companyId: "c1",
  taskKey: "iss_1",
  agentId: "a1",
  chosen: "m1",
  skipped: {},
  signals: [],
  mode: "routed",
})

describe("decision ring", () => {
  it("keeps the newest entries under its cap", () => {
    let ring: DecisionRecord[] = []
    for (let i = 0; i < 205; i += 1) ring = pushDecision(ring, decision(new Date(1_700_000_000_000 + i * 1000).toISOString()))
    expect(ring).toHaveLength(200)
    expect(ring[0]!.at).toBe(new Date(1_700_000_000_000 + 204 * 1000).toISOString())
    expect(ring.at(-1)!.at).toBe(new Date(1_700_000_000_000 + 5 * 1000).toISOString())
  })

  it("is newest first regardless of insertion order", () => {
    const ring = pushDecision([], decision("2026-11-05T00:00:00Z"))
    expect(ring[0]!.at).toBe("2026-11-05T00:00:00Z")
  })
})

describe("failure memory", () => {
  const record = (o: Partial<FailureRecord>): FailureRecord => ({ memberId: "m1", at: "2026-11-05T00:00:00Z", taskKey: "iss_1", class: "deterministic", ...o })

  it("keeps recent failures active and expires older ones", () => {
    const now = new Date("2026-11-05T00:31:00Z")
    expect(activeFailures([record({ at: "2026-11-05T00:10:00Z" })], now, 30).has("m1")).toBe(true)
    expect(activeFailures([record({ at: "2026-11-05T00:00:00Z" })], now, 30).has("m1")).toBe(false)
  })

  it("ignores non deterministic failures", () => {
    const now = new Date("2026-11-05T00:05:00Z")
    expect(activeFailures([record({ class: "outage" })], now, 30).size).toBe(0)
  })

  it("ignores a failure recorded for a different task", () => {
    const now = new Date("2026-11-05T00:05:00Z")
    expect(activeFailures([record({ taskKey: "other" })], now, 30, "iss_1").size).toBe(0)
    expect(activeFailures([record({ taskKey: "iss_1" })], now, 30, "iss_1").has("m1")).toBe(true)
  })
})
