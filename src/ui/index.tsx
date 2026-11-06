import { usePluginData, type PluginPageProps } from "@paperclipai/plugin-sdk/ui"
import { DecisionsError, DecisionsLoading, DecisionsView, type DecisionsPayload } from "./decisions.js"

/**
 * Host page entrypoint. The manifest names this export, so the component must be
 * exported exactly as `RouterDecisionsPage`. Data comes from the worker's
 * `decisions` handler, scoped to the current company.
 */
export { RouterSidebarEntry } from "./sidebar-entry.js"

export function RouterDecisionsPage({ context }: PluginPageProps) {
  const { data, loading, error } = usePluginData<DecisionsPayload>("decisions", { companyId: context.companyId })

  // Only a cold load shows the skeleton. A refresh keeps the real content on
  // screen, so the page never flashes back to placeholders while polling.
  if (loading && !data) return <DecisionsLoading />
  if (error) return <DecisionsError message={error.message} />
  return <DecisionsView data={data ?? undefined} />
}
