import { definePlugin, runWorker } from "@paperclipai/plugin-sdk"

/**
 * The worker wires Paperclip's router hook to the decision core. Until the
 * core lands (task 5), it selects the first authorized candidate, which is the
 * host's own reference behavior, so the plugin is installable and observable
 * at every step.
 */
const plugin = definePlugin({
  multiCompanyConfig: true,

  async setup() {},

  async onRouteAiConnection(request) {
    const first = request.candidates[0]
    return first
      ? { kind: "selected", memberId: first.member.id }
      : { kind: "unavailable", skipped: {} }
  },
})

export default plugin
runWorker(plugin, import.meta.url)
