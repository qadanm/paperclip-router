import { useHostContext, useHostNavigation } from "@paperclipai/plugin-sdk/ui"
import { BrandMark } from "./theme.js"

/**
 * The sidebar entry.
 *
 * A plugin page in Paperclip has a URL but no navigation entry unless the plugin
 * renders one. This is that entry: a `sidebar` slot, so Smart Router sits in the
 * company sidebar next to Tasks and Projects.
 *
 * It is a host link via `linkProps`, so modifier-click, middle-click, copy-link
 * and open-in-new-tab behave like every other link in the app. Styling leans on
 * the host's own row treatment (`text-foreground`, `hover:bg-accent`) instead of
 * hardcoded colors, so it inherits the active theme and any future host restyle.
 */
export function RouterSidebarEntry() {
  const host = useHostContext()
  const navigation = useHostNavigation()
  const href = host.companyPrefix ? `/${host.companyPrefix}/router` : "/router"

  return (
    <a
      {...navigation.linkProps(href)}
      data-paperclip-router-entry=""
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "6px 10px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 500,
        color: "var(--foreground)",
        textDecoration: "none",
        lineHeight: 1.4,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = "var(--accent)"
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = "transparent"
      }}
    >
      {/* The brand pair is defined here as the theme's gradient variables, so the
          mark matches the page without a second source of truth. */}
      <span
        style={
          {
            "--sr-from": "#0f766e",
            "--sr-to": "#0891b2",
            display: "flex",
          } as React.CSSProperties
        }
        className="sr-sidebar-mark"
      >
        <BrandMark height={15} />
      </span>
      <style>{`.dark .sr-sidebar-mark { --sr-from: #2dd4bf; --sr-to: #67e8f9; }`}</style>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Smart Router</span>
    </a>
  )
}
