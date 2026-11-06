const mod = await import("/Users/muhammedqadan/Documents/dev/paperclip-router/dist/worker.js")
const d = mod.default.definition
const writes = []
const ctx = {
  config: { get: async () => ({}) },
  state: { get: async () => null, set: async (k, v) => writes.push(v) },
  issues: { get: async () => ({ title: "Migrate the billing service to event sourcing", description: "multi-tenant" }) },
  data: { register: () => undefined },
  events: { on: () => () => undefined },
  logger: { info(){}, error(){} },
}
await d.setup(ctx)
const member = (id, model) => ({
  member: { id, binding: { mode: "shared", provider: "openai", method: "api_key", connectionId: "c-"+id, grantId: "g-"+id }, profile: { provider: "codex", model } },
  runtimeConfig: { model }, notes: [],
})
await d.onRouteAiConnection({
  companyId: "co1", agentId: "a1", taskKey: "TUC-1", lastMemberId: null, cursorVersion: 0, memberOrder: ["m-cheap","m-strong"], now: new Date().toISOString(),
  pool: { id: "p1", companyId: "co1", pluginKey: "qadan.paperclip-router", revision: 1, name: "p", enabled: true, mode: "usage_aware", thresholdPercent: 85, members: [] },
  candidates: [member("m-cheap","deepseek-v4.1-flash"), member("m-strong","claude-sonnet-5-5")],
})
await new Promise(r => setTimeout(r, 50))
const ring = writes.find(Array.isArray) ?? []
const latest = ring[0]
console.log(JSON.stringify({ chosen: latest.chosen, chosenLabel: latest.chosenLabel, labels: latest.labels, skipped: latest.skipped }, null, 1))
