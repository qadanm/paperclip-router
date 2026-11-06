import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { DecisionsError, DecisionsLoading, DecisionsView } from "../src/ui/decisions.js"

const decision = {
  at: "2026-11-05T00:00:00Z",
  companyId: "c1",
  taskKey: "iss_1",
  agentId: "a1",
  chosen: "m1",
  chosenLabel: "claude-sonnet-5-5 · codex",
  skipped: { m2: "weekly window 82% used, resets in 2d" },
  labels: { m1: "claude-sonnet-5-5 · codex", m2: "deepseek-v4.1-flash · codex" },
  signals: ["narrow_scope"],
  tier: 2 as const,
  confidence: 0.9,
  mode: "routed" as const,
}

const member = (overrides: Record<string, unknown> = {}) => ({
  memberId: "m1",
  label: "claude-sonnet-5-5 · codex",
  chosenCount: 3,
  lastChosenAt: "2026-11-06T12:00:00Z",
  benched: false,
  ...overrides,
})

describe("decisions page", () => {
  it("renders the task, the chosen member, and the skip reasons", () => {
    const html = renderToStaticMarkup(<DecisionsView data={{ decisions: [decision], members: [] }} />)
    expect(html).toContain("claude-sonnet-5-5 · codex")
    expect(html).toContain("weekly window 82% used")
    expect(html).toContain("deepseek-v4.1-flash · codex")
  })

  it("shows held-back members with their standing", () => {
    const html = renderToStaticMarkup(
      <DecisionsView
        data={{
          decisions: [decision],
          members: [
            member({
              benched: true,
              benchReason: "rejected a request deterministically",
              benchedUntil: "2026-11-06T12:30:00Z",
            }),
          ],
        }}
      />,
    )
    expect(html).toContain("held back")
    expect(html).toContain("free again")
  })

  it("says how many older records were repaired", () => {
    const html = renderToStaticMarkup(<DecisionsView data={{ decisions: [decision], members: [], repaired: 3 }} />)
    expect(html).toContain("3 older records were")
  })

  it("explains an empty history with the steps that produce one", () => {
    const html = renderToStaticMarkup(<DecisionsView data={{ decisions: [], members: [] }} />)
    expect(html).toContain("No decisions yet")
    expect(html).toContain("Point an agent&#x27;s AI connection at that pool.")
  })

  it("states the active mode, and dry run when every decision is one", () => {
    const routed = renderToStaticMarkup(<DecisionsView data={{ decisions: [decision], members: [] }} />)
    expect(routed).toContain("routing")
    const dry = renderToStaticMarkup(<DecisionsView data={{ decisions: [{ ...decision, mode: "dry-run" }], members: [] }} />)
    expect(dry).toContain("dry run")
  })

  it("draws the tier as an ordinal and admits a borderline call", () => {
    const html = renderToStaticMarkup(<DecisionsView data={{ decisions: [{ ...decision, confidence: 0.4 }], members: [] }} />)
    expect(html).toContain("tier 2 · borderline")
    expect(html).toContain('class="on"')
  })

  it("expands reasoning in place, with native disclosure semantics", () => {
    const html = renderToStaticMarkup(<DecisionsView data={{ decisions: [decision], members: [] }} />)
    expect(html).toContain("<details")
    expect(html).toContain("<summary")
    expect(html).toContain("Passed over")
  })

  it("leads each row with the task, not the model", () => {
    const html = renderToStaticMarkup(
      <DecisionsView data={{ decisions: [{ ...decision, taskTitle: "Add billing webhooks" }], members: [] }} />,
    )
    expect(html).toContain("Add billing webhooks")
    // The model stays, one line down, as the answer rather than the question.
    expect(html).toContain("claude-sonnet-5-5 · codex")
  })

  it("falls back to the short task reference when no title could be resolved", () => {
    const html = renderToStaticMarkup(<DecisionsView data={{ decisions: [decision], members: [] }} />)
    expect(html).toContain("iss_1")
  })

  it("translates classifier signals into phrases", () => {
    const html = renderToStaticMarkup(<DecisionsView data={{ decisions: [decision], members: [] }} />)
    expect(html).toContain("narrow scope")
    expect(html).not.toContain("narrow_scope")
  })

  it("caps the list until asked, and offers the rest", () => {
    const many = Array.from({ length: 12 }, (_, index) => ({ ...decision, at: `2026-11-05T00:0${index}:00Z` }))
    const html = renderToStaticMarkup(<DecisionsView data={{ decisions: many, members: [] }} />)
    expect(html).toContain("Show all 12")
    expect((html.match(/<summary class="sr-tr sr-summary"/g) ?? []).length).toBe(8)
  })

  it("themes from the host tokens instead of hardcoding a light palette", () => {
    // The regression this guards: an earlier build read another app's `--v2-*`
    // tokens, every lookup missed, and the page rendered white in dark mode.
    const html = renderToStaticMarkup(<DecisionsView data={{ decisions: [decision], members: [member()] }} />)
    expect(html).toContain("var(--background)")
    expect(html).toContain("var(--foreground)")
    expect(html).toContain("var(--muted-foreground)")
    expect(html).toContain(".dark .sr-page")
    expect(html).not.toContain("--v2-")
    // No literal page surface colors anywhere in the markup.
    expect(html).not.toMatch(/background:\s*(#fff|white|#ffffff)/i)
    expect(html).not.toMatch(/color:\s*#[0-9a-f]{3,6}\s*;\s*font-size/i)
  })

  it("keeps an error explainable without pretending routing stopped", () => {
    const html = renderToStaticMarkup(<DecisionsError message="worker timeout" />)
    expect(html).toContain("Could not read router state")
    expect(html).toContain("Routing is unaffected")
    expect(html).toContain("worker timeout")
  })

  it("reserves layout while loading rather than shifting", () => {
    const html = renderToStaticMarkup(<DecisionsLoading />)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain("sr-skeleton-row")
  })
})
