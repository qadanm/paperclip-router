import { describe, expect, it } from "vitest"
import manifest from "../src/manifest.js"

describe("plugin manifest", () => {
  it("declares exactly the capabilities the plugin uses", () => {
    expect([...manifest.capabilities].sort()).toEqual([
      "ai.connections.route",
      "events.subscribe",
      "issues.read",
      "plugin.state.read",
      "plugin.state.write",
      "ui.page.register",
    ])
  })

  it("declares the connection router descriptor", () => {
    expect(manifest.aiConnectionRouter?.name).toBe("Smart Router pool")
    expect(manifest.aiConnectionRouter?.description.length).toBeGreaterThan(0)
  })

  it("registers the decisions page", () => {
    expect(manifest.ui?.slots).toContainEqual({
      type: "page",
      id: "router-decisions",
      displayName: "Smart Router",
      exportName: "RouterDecisionsPage",
      routePath: "router",
    })
  })

  it("builds for Paperclip 1 and Node 24", () => {
    expect(manifest.apiVersion).toBe(1)
    expect(manifest.entrypoints.worker).toBe("./dist/worker.js")
    expect(manifest.entrypoints.ui).toBe("./dist/ui")
  })
})
