import { describe, expect, it } from "vitest"
import { classifyRunError } from "../src/core/failures.js"
import { activeFailures, pushDecision, type FailureRecord } from "../src/core/store.js"

/**
 * Failure handling, informed by two MIT routers:
 *
 * ClawRouter (`src/retry.ts`, `isRetryable`) retries 429/502/503/504 with
 * exponential backoff and honours `Retry-After`. Two lessons:
 * - Honour the server's own `Retry-After` instead of guessing a delay. They do
 *   this for 429 and it is the right call; we keep it.
 * - Their default policy is a bare status list and a fixed attempt count, with
 *   no notion of "this model will keep failing, try another". A retry loop that
 *   cannot change model is how a turn burns its budget on one bad endpoint.
 *   Our router sits above that: a deterministic rejection benches the member for
 *   new tasks, and a transient fault is retried by the host, not by us.
 *
 * RouteLLM and the other learned routers contributed nothing here; their value
 * is model-quality prediction, which we get from configured tiers.
 */

const at = (iso: string) => new Date(iso)

describe("error classification", () => {
  it("calls a request-shape rejection deterministic", () => {
    expect(classifyRunError({ error: "Invalid discriminator value. Expected 'user' | 'assistant'" })).toBe("deterministic")
  })

  it("calls capacity and 5xx faults an outage, never the member's fault", () => {
    expect(classifyRunError({ error: "502 Bad Gateway" })).toBe("outage")
    expect(classifyRunError({ error: "service unavailable" })).toBe("outage")
    expect(classifyRunError({ error: "upstream connect error" })).toBe("outage")
  })

  it("separates rate limits from outages", () => {
    expect(classifyRunError({ error: "429 Too Many Requests" })).toBe("rate_limit")
    expect(classifyRunError({ error: "rate limit exceeded" })).toBe("rate_limit")
  })

  it("does not blame a member for auth or billing faults", () => {
    expect(classifyRunError({ error: "401 Unauthorized" })).toBe("other")
    expect(classifyRunError({ error: "insufficient credits" })).toBe("other")
    expect(classifyRunError({ error: "workspace_billing_scope_unavailable", errorCode: "database_unavailable" })).toBe("other")
  })

  it("never treats an unknown message as deterministic", () => {
    expect(classifyRunError({ error: "process exited with code 1" })).toBe("other")
    expect(classifyRunError({})).toBe("other")
  })
})

describe("failure memory", () => {
  const record = (o: Partial<FailureRecord> = {}): FailureRecord => ({
    memberId: "m1",
    at: "2026-11-05T00:00:00Z",
    taskKey: "iss_1",
    class: "deterministic",
    ...o,
  })

  it("holds a member back only for the task signature that tripped it", () => {
    const now = at("2026-11-05T00:05:00Z")
    const records = [record({ taskKey: "iss_1" })]
    expect(activeFailures(records, now, 30, "iss_1").has("m1")).toBe(true)
    expect(activeFailures(records, now, 30, "iss_2").has("m1")).toBe(false)
  })

  it("expires and ignores non-deterministic classes", () => {
    const now = at("2026-11-05T00:40:00Z")
    expect(activeFailures([record({ at: "2026-11-05T00:00:00Z" })], now, 30).size).toBe(0)
    expect(activeFailures([record({ class: "outage" })], now, 30).size).toBe(0)
    expect(activeFailures([record({ class: "rate_limit" })], now, 30).size).toBe(0)
  })
})

describe("decision ring", () => {
  it("stays bounded and newest first", () => {
    let ring: ReturnType<typeof pushDecision> = []
    for (let i = 0; i < 220; i += 1) {
      ring = pushDecision(ring, {
        at: String(i),
        companyId: "c",
        taskKey: "t",
        agentId: "a",
        chosen: "m",
        skipped: {},
        signals: [],
        tier: 2,
        confidence: 0.9,
        mode: "routed",
      })
    }
    expect(ring).toHaveLength(200)
    expect(ring[0]!.at).toBe("219")
  })
})
