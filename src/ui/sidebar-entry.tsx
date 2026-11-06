import { useHostNavigation, useHostContext } from "@paperclipai/plugin-sdk/ui"

/**
 * The sidebar entry.
 *
 * A plugin page in Paperclip has a URL but no navigation entry unless the plugin
 * renders one. This is that entry: a `sidebar` slot, so "Smart Router" sits in
 * the company sidebar next to Tasks and Projects.
 *
 * It is a real anchor via `linkProps`, so modifier-click, middle-click,
 * copy-link and open-in-new-tab all behave like every other link in the app.
 */
export function RouterSidebarEntry() {
  const host = useHostContext()
  const navigation = useHostNavigation()
  const href = host.companyPrefix ? `/${host.companyPrefix}/router` : "/router"

  return (
    <a
      {...navigation.linkProps(href)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "6px 10px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 500,
        color: "var(--v2-text-text-base, #1a1a1d)",
        textDecoration: "none",
      }}
      data-paperclip-router-entry=""
    >
      <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="sr-sidebar-mark" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#0f766e" />
            <stop offset="1" stopColor="#0891b2" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="14.5" fill="none" stroke="url(#sr-sidebar-mark)" strokeWidth="2.4" />
        <path
          d="M7.5 19.5c3-2 6-2 8.5-4.2s4.5-4.3 8.5-4.3"
          fill="none"
          stroke="url(#sr-sidebar-mark)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      Smart Router
    </a>
  )
}
