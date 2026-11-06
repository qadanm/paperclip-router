import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { DecisionsView } from "../src/ui/decisions.js"

const decision = {
  at: "2026-11-05T00:00:00Z",
  companyId: "c1",
  taskKey: "iss_1",
  agentId: "a1",
  chosen: "m1",
  skipped: { m2: "weekly window 82% used, resets in 2d" },
  signals: ["narrow_scope"],
  tier: 2 as const,
  confidence: 0.9,
  mode: "routed" as const,
}

describe("decisions page", () => {
  it("renders the task, the chosen member, and the skip reasons", () => {
    const html = renderToStaticMarkup(<DecisionsView data={{ decisions: [decision], members: [] }} />)
    expect(html).toContain("iss_1")
    expect(html).toContain("m1")
    expect(html).toContain("weekly window 82% used")
  })

  it("explains an empty history", () => {
    const html = renderToStaticMarkup(<DecisionsView data={{ decisions: [], members: [] }} />)
    expect(html).toContain("No decisions yet")
  })
})
