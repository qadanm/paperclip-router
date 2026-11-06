import { describe, expect, it } from "vitest"
import { classifyTask } from "../src/core/classify.js"

describe("classifyTask", () => {
  it("keeps a narrow rename at tier 1", () => {
    const task = classifyTask({ title: "Rename the settings button label" })
    expect(task.kind).toBe("mechanical")
    expect(task.tier).toBe(1)
  })

  it("puts an architecture migration at tier 3", () => {
    const task = classifyTask({ title: "Migrate the billing service to event sourcing" })
    expect(task.kind).toBe("architecture")
    expect(task.tier).toBe(3)
  })

  it("treats a stack trace as debug work", () => {
    const task = classifyTask({
      title: "Checkout crash on iPad",
      description: "TypeError: undefined is not a function\n  at render (app.js:42)",
    })
    expect(task.kind).toBe("debug")
    expect(task.signals).toContain("stack_trace")
  })

  it("does not let a self described simple task hide a project wide change", () => {
    const task = classifyTask({ title: "Simple refactor everywhere in the repo" })
    expect(task.tier).toBeGreaterThan(1)
    expect(task.signals).toContain("self_described_simple_ignored")
  })

  it("returns unknown for empty input", () => {
    expect(classifyTask({ title: "" }).kind).toBe("unknown")
  })
})
