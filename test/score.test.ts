import { describe, expect, it } from "vitest"
import { rankCandidates, type Candidate, type RankingPolicy } from "../src/core/score.js"
import type { MemberUsage } from "../src/core/windows.js"
import type { TaskClass } from "../src/core/classify.js"

const now = new Date("2026-11-05T00:00:00Z")
const policy: RankingPolicy = {
  floorByTier: { 1: 1, 2: 2, 3: 3 },
  modelTier: { "claude-haiku-5": 1, "claude-sonnet-5": 2, "claude-opus-5": 3 },
  expiryWeight: 1,
}
const task = (tier: 1 | 2 | 3, kind: TaskClass["kind"] = "feature"): TaskClass => ({ kind, tier, signals: [] })
const c = (o: Partial<Candidate> & { memberId: string }): Candidate => ({
  model: "claude-sonnet-5",
  provider: "acpx",
  ...o,
})
const busy = (usedPercent: number): MemberUsage => ({
  status: "ok",
  checkedAt: "2026-11-05T00:00:00Z",
  limits: [
    {
      id: "w",
      label: "Weekly",
      scope: null,
      windowSeconds: 604800,
      resetsAt: "2026-11-10T00:00:00.000Z",
      usedPercent,
      remainingPercent: 100 - usedPercent,
      limitReached: usedPercent >= 100,
    },
  ],
})

const rank = (input: Parameters<typeof rankCandidates>[0]) => rankCandidates(input)

describe("rankCandidates", () => {
  it("protects the strong account for architecture work", () => {
    const result = rank({
      task: task(3, "architecture"),
      candidates: [c({ memberId: "cheap", model: "claude-haiku-5" }), c({ memberId: "strong", model: "claude-opus-5" })],
      memberOrder: ["cheap", "strong"],
      lastMemberId: null,
      memory: new Set(),
      policy,
      now,
    })
    expect(result.chosen).toBe("strong")
  })

  it("uses the runtime model, and an unknown model below the floor is still chosen as a last resort", () => {
    const result = rank({
      task: task(3, "architecture"),
      candidates: [c({ memberId: "mystery", model: "mystery-model" })],
      memberOrder: ["mystery"],
      lastMemberId: null,
      memory: new Set(),
      policy,
      now,
    })
    // The floor is a preference, not a veto: a pool of unknown models must
    // still route, with the deviation stated on the decision.
    expect(result.chosen).toBe("mystery")
    expect(result.skipped.mystery).toContain("tier 2")
  })

  it("rotates on ties instead of re-pinning the last member", () => {
    const first = rank({
      task: task(2),
      candidates: [c({ memberId: "a" }), c({ memberId: "b" }), c({ memberId: "c" })],
      memberOrder: ["a", "b", "c"],
      lastMemberId: null,
      memory: new Set(),
      policy,
      now,
    })
    const second = rank({
      task: task(2),
      candidates: [c({ memberId: "a" }), c({ memberId: "b" }), c({ memberId: "c" })],
      memberOrder: ["a", "b", "c"],
      lastMemberId: "a",
      memory: new Set(),
      policy,
      now,
    })
    expect(first.chosen).toBe("a")
    expect(second.chosen).toBe("b")
  })

  it("skips a member with failure memory and names the reason", () => {
    const result = rank({
      task: task(2),
      candidates: [c({ memberId: "a" }), c({ memberId: "b" })],
      memberOrder: ["a", "b"],
      lastMemberId: null,
      memory: new Set(["b"]),
      policy,
      now,
    })
    expect(result.chosen).toBe("a")
    expect(result.skipped.b).toContain("rejected a request")
  })

  it("skips members whose usage is blocked and says why", () => {
    const result = rank({
      task: task(2),
      candidates: [c({ memberId: "a", usage: busy(100) }), c({ memberId: "b" })],
      memberOrder: ["a", "b"],
      lastMemberId: null,
      memory: new Set(),
      policy,
      now,
    })
    expect(result.chosen).toBe("b")
    expect(result.skipped.a).toContain("limit reached")
  })

  it("returns no chosen when every candidate is skipped", () => {
    const result = rank({
      task: task(2),
      candidates: [c({ memberId: "a", usage: busy(100) }), c({ memberId: "b", usage: busy(100) })],
      memberOrder: ["a", "b"],
      lastMemberId: null,
      memory: new Set(),
      policy,
      now,
    })
    expect(result.chosen).toBeUndefined()
    expect(Object.keys(result.skipped).sort()).toEqual(["a", "b"])
  })
})
