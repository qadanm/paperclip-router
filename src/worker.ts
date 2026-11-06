import { definePlugin, runWorker } from "@paperclipai/plugin-sdk"
import manifest from "./manifest.js"
import { RouterHost, usageFrom, type RouterConfig } from "./host.js"

/**
 * The worker is a thin shell: it normalizes the host request, hands the decision
 * to RouterHost, and never lets an exception escape into a blocked run. Each
 * route call answers within the host's 5 second budget, so the only awaited
 * work is cached config, one issue lookup, and pure computation.
 */
const plugin = definePlugin({
  multiCompanyConfig: true,

  async setup(ctx) {
    host = new RouterHost(ctx)
    ctx.data.register("decisions", async (params) => {
      const companyId = typeof params.companyId === "string" ? params.companyId : undefined
      if (!companyId) return { decisions: [], members: [] }
      await host!.ensureLoaded(companyId)
      return host!.data(companyId)
    })
    ctx.events.on("agent.run.failed", async (event) => {
      const payload = event.payload as Record<string, unknown>
      const companyId = event.companyId
      const agentId = typeof payload.agentId === "string" ? payload.agentId : undefined
      if (!companyId || !agentId) return
      await host!.recordRunFailure(
        companyId,
        agentId,
        typeof payload.issueId === "string" ? payload.issueId : undefined,
        typeof payload.error === "string" ? payload.error : undefined,
        typeof payload.errorCode === "string" ? payload.errorCode : undefined,
      )
    })
  },

  async onRouteAiConnection(request) {
    const first = request.candidates[0]
    try {
      if (!host) {
        return first ? { kind: "selected", memberId: first.member.id } : { kind: "unavailable", skipped: {} }
      }
      const result = await host.decide({
        companyId: request.companyId,
        agentId: request.agentId,
        taskKey: request.taskKey,
        request: {
          pinnedMemberId: request.pinnedMemberId,
          memberOrder: request.memberOrder,
          lastMemberId: request.lastMemberId,
          candidates: request.candidates.map((candidate) => ({
            memberId: candidate.member.id,
            model: typeof candidate.runtimeConfig.model === "string" ? candidate.runtimeConfig.model : candidate.member.profile.model,
            provider: candidate.member.profile.provider,
            usage: usageFrom(candidate.usage),
          })),
        },
      })
      return result
    } catch {
      return first ? { kind: "selected", memberId: first.member.id } : { kind: "unavailable", skipped: {} }
    }
  },
})

let host: RouterHost | null = null

export default plugin
runWorker(plugin, import.meta.url)
