import { describe, expect, it } from "vitest"
import { memberStates } from "../src/core/members.js"
import type { DecisionRecord, FailureRecord } from "../src/core/store.js"

const at = (iso: string) => new Date(iso)

const decision = (o: Partial<DecisionRecord> = {}): DecisionRecord => ({
  at: "2026-11-06T12:00:00Z",
  companyId: "c1",
  taskKey: "iss_1",
  agentId: "a1",
  chosen: "m1",
  chosenLabel: "claude-sonnet-5-5 · codex",
  labels: { m1: "claude-sonnet-5-5 · codex", m2: "deepseek-v4.1-flash · codex" },
  skipped: {},
  signals: [],
  tier: 2,
  confidence: 0.8,
  mode: "routed",
  ...o,
})

const failure = (o: Partial<FailureRecord> = {}): FailureRecord => ({
  memberId: "m1",
  at: "2026-11-06T12:05:00Z",
  taskKey: "iss_1",
  class: "deterministic",
  ...o,
})

describe("member states", () => {
  it("counts choices per member and keeps the newest", () => {
    const states = memberStates({
      decisions: [decision({ at: "2026-11-06T12:10:00Z" }), decision({ at: "2026-11-06T12:00:00Z" })],
      failures: [],
      now: at("2026-11-06T12:20:00Z"),
      memoryMinutes: 30,
    })
    const m1 = states.find((state) => state.memberId === "m1")!
    expect(m1.chosenCount).toBe(2)
    expect(m1.lastChosenAt).toBe("2026-11-06T12:10:00Z")
    expect(m1.benched).toBe(false)
  })

  it("marks a member benched while its rejection is inside the window", () => {
    const states = memberStates({
      decisions: [decision()],
      failures: [failure()],
      now: at("2026-11-06T12:20:00Z"),
      memoryMinutes: 30,
    })
    const m1 = states.find((state) => state.memberId === "m1")!
    expect(m1.benched).toBe(true)
    expect(m1.benchReason).toContain("rejected a request")
    expect(Date.parse(m1.benchedUntil!)).toBe(Date.parse("2026-11-06T12:35:00Z"))
  })

  it("releases a member once the window passes", () => {
    const states = memberStates({
      decisions: [decision()],
      failures: [failure()],
      now: at("2026-11-06T13:00:00Z"),
      memoryMinutes: 30,
    })
    expect(states.find((state) => state.memberId === "m1")!.benched).toBe(false)
  })

  it("ignores outages and rate limits", () => {
    const states = memberStates({
      decisions: [decision()],
      failures: [failure({ class: "outage" }), failure({ memberId: "m2", class: "rate_limit" })],
      now: at("2026-11-06T12:10:00Z"),
      memoryMinutes: 30,
    })
    expect(states.every((state) => !state.benched)).toBe(true)
    // m2 appears because the decision labelled it, but an outage or rate limit
    // must never bench it.
    expect(states.find((state) => state.memberId === "m2")?.benched).toBe(false)
  })

  it("lists a benched member that never served in the retained window", () => {
    const states = memberStates({
      decisions: [],
      failures: [failure({ memberId: "m9" })],
      now: at("2026-11-06T12:10:00Z"),
      memoryMinutes: 30,
    })
    expect(states).toHaveLength(1)
    expect(states[0]!.memberId).toBe("m9")
    expect(states[0]!.chosenCount).toBe(0)
    expect(states[0]!.benched).toBe(true)
  })

  it("puts benched members first", () => {
    const states = memberStates({
      decisions: [decision(), decision({ chosen: "m2", at: "2026-11-06T12:15:00Z" })],
      failures: [failure({ memberId: "m1" })],
      now: at("2026-11-06T12:20:00Z"),
      memoryMinutes: 30,
    })
    expect(states[0]!.memberId).toBe("m1")
    expect(states[0]!.benched).toBe(true)
  })

  it("includes every labelled member, even one that never won", () => {
    // The decision records the label for both members, but only m1 was chosen.
    const states = memberStates({
      decisions: [decision()],
      failures: [],
      now: at("2026-11-06T12:10:00Z"),
      memoryMinutes: 30,
    })
    const m2 = states.find((state) => state.memberId === "m2")
    expect(m2).toBeDefined()
    expect(m2!.chosenCount).toBe(0)
    expect(m2!.label).toBe("deepseek-v4.1-flash · codex")
    expect(m2!.benched).toBe(false)
  })

  it("uses the pool label when the history has none", () => {
    const states = memberStates({
      decisions: [],
      failures: [],
      now: at("2026-11-06T12:00:00Z"),
      memoryMinutes: 30,
      poolMembers: [{ memberId: "m3", label: "gpt-6-sol · codex" }],
    })
    expect(states[0]!.label).toBe("gpt-6-sol · codex")
  })
})
