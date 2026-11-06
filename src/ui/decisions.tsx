import type { DecisionRecord } from "../core/store.js"

export interface DecisionsPayload {
  readonly decisions: ReadonlyArray<DecisionRecord>
  readonly members: ReadonlyArray<{ memberId: string; chosen: boolean }>
}

const shortTime = (iso: string) => {
  const date = new Date(iso)
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : iso
}

/**
 * The explanation surface. Paperclip OSS does not render the router's skipped
 * reasons anywhere, so this page is where a person can see why a pool member
 * won, and why the others did not. Server-renderable for tests; no host imports.
 */
export function DecisionsView({ data }: { data: DecisionsPayload | undefined }) {
  const decisions = data?.decisions ?? []
  if (decisions.length === 0) {
    return (
      <section style={{ fontFamily: "system-ui, sans-serif", color: "#e8e8ec", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Smart Router</h1>
        <p style={{ color: "#9a9aa6", marginTop: 12, maxWidth: "60ch" }}>
          No decisions yet. Point an agent at a Smart Router pool and the next task will appear here with the member it
          chose and the reasons the others lost.
        </p>
      </section>
    )
  }
  return (
    <section style={{ fontFamily: "system-ui, sans-serif", color: "#e8e8ec", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Smart Router</h1>
      <p style={{ color: "#9a9aa6", marginTop: 6, fontSize: 14 }}>
        Newest first. Every row shows the member this pool chose and the reason each other member was passed over.
      </p>
      <ul style={{ listStyle: "none", margin: "20px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        {decisions.map((decision, index) => (
          <li
            key={`${decision.at}-${index}`}
            style={{ border: "1px solid #2a2a33", borderRadius: 10, padding: "14px 16px", background: "#16161c" }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>{decision.chosen ?? "no eligible member"}</strong>
              <span style={{ color: "#9a9aa6", fontSize: 12 }}>{decision.taskKey}</span>
              <span style={{ color: "#6f6f7c", fontSize: 12, marginLeft: "auto" }}>
                {shortTime(decision.at)}
                {decision.mode === "dry-run" ? " · dry run" : ""}
              </span>
            </div>
            <div style={{ color: "#7dd3e8", fontSize: 12, marginTop: 6 }}>
              tier {decision.tier}
              {decision.confidence < 0.6 ? " · borderline, nearest tier" : ""}
              {decision.signals.length > 0 ? ` · ${decision.signals.join(", ")}` : ""}
            </div>
            {Object.entries(decision.skipped).length > 0 ? (
              <dl style={{ margin: "10px 0 0", display: "grid", gridTemplateColumns: "max-content 1fr", gap: "4px 12px" }}>
                {Object.entries(decision.skipped).map(([memberId, reason]) => (
                  <div key={memberId} style={{ display: "contents" }}>
                    <dt style={{ color: "#9a9aa6", fontSize: 12, fontFamily: "ui-monospace, monospace" }}>{memberId}</dt>
                    <dd style={{ margin: 0, color: "#c9c9d1", fontSize: 12, lineHeight: 1.5 }}>{reason}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
