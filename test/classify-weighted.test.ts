import { describe, expect, it } from "vitest"
import { classifyTask } from "../src/core/classify.js"

/**
 * Weighted-dimension classification, modelled on ClawRouter's MIT router core
 * (`dist/router/index.js`: `classifyByRules`).
 *
 * What we take from it, because it fixes a real weakness in a keyword ladder:
 * - Many small dimensions, each scoring 0..1-ish, combined by explicit weights.
 * - A confidence derived from distance to the nearest tier boundary, so a prompt
 *   that lands near a boundary is reported as uncertain instead of guessing.
 * - A low-confidence result yields no tier, and the caller decides. In our
 *   router "no tier" means "use the middle member", never "fail the task".
 *
 * What we deliberately do differently:
 * - Their `simple` keywords subtract a flat -1 at any count, so "simple" in a
 *   long architectural brief badly skews the score. We cap the discount and
 *   require a short prompt before it applies.
 * - Their thresholds are tuned for OpenAI-style chat prompts. Paperclip issues
 *   have a title and a description that often contains a task list, so the
 *   imperative and constraint dimensions weight higher and the token dimension
 *   lower.
 * - Their `classifiedTier` can be null; ours always returns a tier so a pool is
 *   never left without a pick, but it also returns `confidence` so the decision
 *   page can say "borderline".
 */

const task = (title: string, description?: string, labels?: string[]) => classifyTask({ title, description, labels })

describe("weighted classification", () => {
  it("reports confidence alongside the tier", () => {
    const result = task("Rename the settings button label")
    expect(result.tier).toBe(1)
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it("a long architecture brief is not discounted by the word simple", () => {
    const brief =
      "This looks simple but it is not. Migrate the billing service to event sourcing across four services, " +
      "keep tenant isolation, design the migration path for existing invoices, and add a rollback plan for production."
    const result = task("Billing migration", brief)
    expect(result.tier).toBe(3)
    expect(result.signals).not.toContain("simple_discount")
  })

  it("a genuinely short simple request still scores low", () => {
    expect(task("Quick typo fix in the README").tier).toBe(1)
  })

  it("issue descriptions with constraint lists raise the tier", () => {
    const result = task("Add export", "Requirements:\n- must handle 10k rows\n- no new dependencies\n- must not change the API")
    expect(result.tier).toBeGreaterThanOrEqual(2)
    expect(result.signals).toContain("constraints")
  })

  it("a boundary-sitting task reports lower confidence than a decisive one", () => {
    // Tier 3 opening is the boundary at 0.5; a task with one weak architecture
    // signal sits near it, while a security plus architecture brief is decisive.
    const borderline = task("Migrate the settings module to a new folder")
    const clear = task(
      "Security review and architecture migration",
      "Threat model the oauth flow, then migrate the multi-tenant data model and keep tenant isolation across services.",
    )
    expect(borderline.confidence).toBeLessThan(clear.confidence)
  })

  it("is deterministic", () => {
    const input = { title: "Fix the checkout crash", description: "TypeError at cart.ts:42" }
    expect(classifyTask(input)).toEqual(classifyTask(input))
  })
})
