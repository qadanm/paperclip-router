import { usePluginData, type PluginPageProps } from "@paperclipai/plugin-sdk/ui"
import { DecisionsView, type DecisionsPayload } from "./decisions.js"

/**
 * Host page entrypoint. The manifest names this export, so the page component
 * must be exported exactly as `RouterDecisionsPage`. Data comes from the
 * worker's `decisions` handler, scoped to the current company.
 */
export { RouterSidebarEntry } from "./sidebar-entry.js"

export function RouterDecisionsPage({ context }: PluginPageProps) {
  const { data, loading, error } = usePluginData<DecisionsPayload>("decisions", { companyId: context.companyId })
  if (loading) return <p style={{ fontFamily: "system-ui, sans-serif", color: "#9a9aa6", padding: 24 }}>Loading decisions…</p>
  if (error) return <p style={{ fontFamily: "system-ui, sans-serif", color: "#e08a8a", padding: 24 }}>{error.message}</p>
  return <DecisionsView data={data ?? undefined} />
}
