import { describe, expect, it } from "vitest"
import { decideRoute } from "../src/core/decide.js"
import type { RankingPolicy } from "../src/core/score.js"
import type { Candidate } from "../src/core/score.js"
import type { MemberUsage } from "../src/core/windows.js"
import type { TaskClass } from "../src/core/classify.js"

const now = new Date("2026-11-05T00:00:00Z")
const policy: RankingPolicy = {
  floorByTier: { 1: 1, 2: 2, 3: 3 },
  modelTier: { "claude-haiku-5": 1, "claude-sonnet-5": 2, "claude-opus-5": 3 },
  expiryWeight: 1,
}
const task = (tier: 1 | 2 | 3, kind: TaskClass["kind"] = "feature"): TaskClass => ({ kind, tier, confidence: 0.9, signals: [] })
const c = (o: Partial<Candidate> & { memberId: string }): Candidate => ({ model: "claude-sonnet-5", provider: "acpx", ...o })
const blockedUsage = (): MemberUsage => ({
  status: "ok",
  checkedAt: "2026-11-05T00:00:00Z",
  limits: [{ id: "w", label: "Weekly", scope: null, windowSeconds: 604800, resetsAt: "2026-11-08T00:00:00.000Z", usedPercent: 100, remainingPercent: 0, limitReached: true }],
})

const route = (input: Parameters<typeof decideRoute>[0]) => decideRoute(input)

describe("decideRoute", () => {
  it("always returns the pinned member", () => {
    const result = route({
      request: { pinnedMemberId: "a", candidates: [c({ memberId: "a", usage: blockedUsage() })], memberOrder: ["a"], lastMemberId: null },
      task: task(3, "architecture"),
      memory: new Set(["a"]),
      policy,
      now,
    })
    expect(result).toEqual({ kind: "selected", memberId: "a", skipped: {} })
  })

  it("routes on tier and fairness when no usage is observed", () => {
    const result = route({
      request: { candidates: [c({ memberId: "a", model: "claude-haiku-5" }), c({ memberId: "b" })], memberOrder: ["a", "b"], lastMemberId: null },
      task: task(2),
      memory: new Set(),
      policy,
      now,
    })
    expect(result.kind).toBe("selected")
    expect(result).toMatchObject({ memberId: "b" })
  })

  it("still routes when no member reaches the floor, recording the deviation", () => {
    const result = route({
      request: {
        candidates: [c({ memberId: "a", model: "claude-haiku-5" }), c({ memberId: "b", model: "claude-haiku-5" })],
        memberOrder: ["a", "b"],
        lastMemberId: null,
      },
      task: task(3, "architecture"),
      memory: new Set(),
      policy,
      now,
    })
    expect(result.kind).toBe("selected")
    if (result.kind === "selected") expect(result.note).toContain("floor")
  })

  it("returns exhausted, not unavailable, when every observed candidate is blocked", () => {
    const result = route({
      request: {
        candidates: [c({ memberId: "a", usage: blockedUsage() }), c({ memberId: "b", usage: blockedUsage() })],
        memberOrder: ["a", "b"],
        lastMemberId: null,
      },
      task: task(2),
      memory: new Set(),
      policy,
      now,
    })
    expect(result.kind).toBe("exhausted")
  })

  it("returns exhausted with the earliest reset when all observed candidates are blocked", () => {
    const result = route({
      request: {
        candidates: [c({ memberId: "a", usage: blockedUsage() })],
        memberOrder: ["a"],
        lastMemberId: null,
      },
      task: task(2),
      memory: new Set(),
      policy,
      now,
    })
    expect(result.kind).toBe("exhausted")
    if (result.kind === "exhausted") expect(result.retryAt).toBe("2026-11-08T00:00:00.000Z")
  })

  it("selects the tier 1 model for mechanical work when it is cheaper", () => {
    const result = route({
      request: {
        candidates: [c({ memberId: "cheap", model: "claude-haiku-5" }), c({ memberId: "strong", model: "claude-opus-5" })],
        memberOrder: ["cheap", "strong"],
        lastMemberId: null,
      },
      task: task(1, "mechanical"),
      memory: new Set(),
      policy,
      now,
    })
    expect(result).toMatchObject({ kind: "selected", memberId: "cheap" })
  })

  it("never throws on malformed input", () => {
    const result = route({
      request: { candidates: [], memberOrder: [], lastMemberId: null },
      task: task(2),
      memory: new Set(),
      policy,
      now,
    })
    expect(["unavailable", "exhausted"]).toContain(result.kind)
  })
})
