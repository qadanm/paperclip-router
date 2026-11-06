import { describe, expect, it } from "vitest"
import { assessUsage, earliestReset, type MemberUsage, type WindowUsage } from "../src/core/windows.js"

const at = (iso: string) => new Date(iso)
const win = (o: Partial<WindowUsage> = {}): WindowUsage => ({
  id: "w",
  label: "Weekly",
  scope: null,
  windowSeconds: 604800,
  resetsAt: "2026-11-08T00:00:00.000Z",
  usedPercent: 50,
  remainingPercent: 50,
  limitReached: false,
  ...o,
})
const usage = (o: Partial<MemberUsage> = {}): MemberUsage => ({
  status: "ok",
  checkedAt: "2026-11-05T00:00:00Z",
  limits: [win()],
  ...o,
})
const now = at("2026-11-05T00:00:00Z")

describe("assessUsage", () => {
  it("returns unknown when usage is absent", () => {
    expect(assessUsage(undefined, now).state).toBe("unknown")
  })

  it("treats empty and errored usage as unknown", () => {
    expect(assessUsage(usage({ limits: [] }), now).state).toBe("unknown")
    expect(assessUsage(usage({ status: "error" }), now).state).toBe("unknown")
    expect(assessUsage(usage({ status: "unsupported" }), now).state).toBe("unknown")
  })

  it("blocks only on an explicit limit reached", () => {
    expect(assessUsage(usage({ limits: [win({ limitReached: true, usedPercent: 100 })] }), now).state).toBe("blocked")
    expect(assessUsage(usage({ limits: [win({ limitReached: false, usedPercent: 99 })] }), now).state).toBe("ok")
  })

  it("prices allowance that resets soon lower than allowance that resets late", () => {
    const soon = assessUsage(usage({ limits: [win({ usedPercent: 80, resetsAt: "2026-11-05T02:00:00.000Z" })] }), now)
    const late = assessUsage(usage({ limits: [win({ usedPercent: 80, resetsAt: "2026-11-20T00:00:00.000Z" })] }), now)
    expect(soon.pressure).toBeLessThan(late.pressure)
  })

  it("reads a stale observation as unknown", () => {
    expect(assessUsage(usage({ checkedAt: "2026-11-04T00:00:00Z" }), now).state).toBe("unknown")
  })

  it("explains a blocked member in plain text", () => {
    const assessed = assessUsage(usage({ limits: [win({ limitReached: true, label: "Weekly" })] }), now)
    expect(assessed.notes.join(" ")).toContain("Weekly")
  })
})

describe("earliestReset", () => {
  it("returns the soonest future reset across usages", () => {
    const a = usage({ limits: [win({ resetsAt: "2026-11-05T02:00:00.000Z" })] })
    const b = usage({ limits: [win({ resetsAt: "2026-11-06T00:00:00.000Z" })] })
    expect(earliestReset([a, b], now)?.toISOString()).toBe("2026-11-05T02:00:00.000Z")
  })

  it("returns undefined when nothing resets in the future", () => {
    const a = usage({ limits: [win({ resetsAt: "2026-11-01T00:00:00.000Z" })] })
    expect(earliestReset([a], now)).toBeUndefined()
  })
})
