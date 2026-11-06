import { describe, expect, it, vi } from "vitest"
import type { PluginContext } from "@paperclipai/plugin-sdk"
import { RouterHost } from "../src/host.js"

const ctx = (overrides: Partial<Record<string, unknown>> = {}): PluginContext =>
  ({
    config: { get: async () => ({}) },
    state: { get: async () => null, set: async () => undefined },
    issues: { get: async () => null },
    ...overrides,
  }) as unknown as PluginContext

const request = {
  companyId: "c1",
  agentId: "a1",
  taskKey: "iss_1",
  request: {
    memberOrder: ["m1"],
    lastMemberId: null,
    candidates: [{ memberId: "m1", model: "claude-sonnet-5", provider: "acpx" }],
  },
}

describe("RouterHost route path", () => {
  it("answers even when the state write never resolves", async () => {
    // A hung state write must not eat the 5 second route budget: the decision
    // resolves first, and the write drains afterwards.
    const set = vi.fn(() => new Promise<void>(() => undefined))
    const host = new RouterHost(ctx({ state: { get: async () => null, set } }))
    const raced = await Promise.race([
      host.decide(request),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 1000)),
    ])
    expect(raced).not.toBe("timeout")
    expect(raced).toEqual({ kind: "selected", memberId: "m1", skipped: {} })
  })

  it("still routes when every host read fails", async () => {
    const failing = {
      config: { get: async () => { throw new Error("config down") } },
      state: { get: async () => { throw new Error("state down") }, set: async () => { throw new Error("state down") } },
      issues: { get: async () => { throw new Error("issues down") } },
    }
    const host = new RouterHost(ctx(failing))
    const result = await host.decide(request)
    expect(result.kind).toBe("selected")
  })

  it("returns the reference rotation in dry run while recording our choice", async () => {
    const host = new RouterHost(
      ctx({ config: { get: async () => ({ dryRun: true }) } }),
    )
    const result = await host.decide({
      ...request,
      request: {
        memberOrder: ["m1", "m2"],
        lastMemberId: "m1",
        candidates: [
          { memberId: "m1", model: "claude-sonnet-5", provider: "acpx" },
          { memberId: "m2", model: "claude-sonnet-5", provider: "acpx" },
        ],
      },
    })
    expect(result).toMatchObject({ kind: "selected", memberId: "m2" })
    expect(host.data("c1").decisions[0]?.mode).toBe("dry-run")
  })
})

