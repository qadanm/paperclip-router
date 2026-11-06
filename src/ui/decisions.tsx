import type { DecisionRecord } from "../core/store.js"

export interface DecisionsPayload {
  readonly decisions: ReadonlyArray<DecisionRecord>
  readonly members: ReadonlyArray<{ memberId: string; chosen: boolean }>
}

/**
 * Design notes.
 *
 * Paperclip is themeable and light by default, and a plugin page renders inside
 * its own shell. The first version hardcoded a dark palette, which made the page
 * white-on-white in the default theme. Everything here reads the host's own CSS
 * tokens with a fallback, so the page follows light, dark, and any custom theme
 * without knowing which is active.
 *
 * The visual language is Paperclip's: 13px text, grey token colours, 6px radii,
 * a muted uppercase label, and one accent used only for the decision itself. The
 * product's own identity appears in three places and nowhere else: the brand mark
 * in the header, the wordmark, and the gradient hairline under it.
 */

const TOKEN = {
  bg: "var(--v2-background-bg-base, #ffffff)",
  raised: "var(--v2-background-bg-layer-01, #f5f5f6)",
  soft: "var(--v2-background-bg-layer-02, #ececee)",
  text: "var(--v2-text-text-base, #1a1a1d)",
  muted: "var(--v2-text-text-muted, #5f5f6a)",
  faint: "var(--v2-text-text-faint, #85858f)",
  border: "var(--v2-border-border-muted, rgba(0,0,0,0.08))",
  strong: "var(--v2-border-border-strong, rgba(0,0,0,0.2))",
  accent: "var(--v2-background-bg-accent, #2f6fed)",
  good: "var(--v2-state-fg-success, #1f7a45)",
  warn: "var(--v2-state-fg-warning, #8a6100)",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const

/** Smart Router's own accent, used only on the mark and the hairline. */
const BRAND = "linear-gradient(90deg, #0f766e, #0891b2)"

const shortTime = (iso: string) => {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return iso
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: TOKEN.faint,
}

function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="sr-mark" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0f766e" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="url(#sr-mark)" strokeWidth="2" />
      <path d="M7.5 19.5c3-2 6-2 8.5-4.2s4.5-4.3 8.5-4.3" fill="none" stroke="url(#sr-mark)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function Confidence({ tier, confidence }: { tier: 1 | 2 | 3; confidence: number }) {
  const firm = confidence >= 0.7
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: TOKEN.muted }}>
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: firm ? TOKEN.good : TOKEN.warn,
          flexShrink: 0,
        }}
      />
      tier {tier}
      {firm ? "" : " · borderline"}
    </span>
  )
}

/**
 * One decision. The chosen member is the headline; the reasons other members
 * lost sit underneath, because that is the question a person actually asks.
 */
function DecisionCard({ decision }: { decision: DecisionRecord }) {
  const skips = Object.entries(decision.skipped)
  return (
    <li
      style={{
        listStyle: "none",
        border: `1px solid ${TOKEN.border}`,
        borderRadius: 8,
        background: TOKEN.bg,
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontFamily: TOKEN.mono,
              fontSize: 13,
              fontWeight: 600,
              color: TOKEN.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {decision.chosenLabel ?? decision.chosen ?? "no eligible member"}
          </span>
          {decision.chosen ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: TOKEN.good,
                border: `1px solid ${TOKEN.border}`,
                borderRadius: 999,
                padding: "1px 7px",
                background: TOKEN.raised,
              }}
            >
              CHOSEN
            </span>
          ) : null}
        </span>
        <span style={{ fontSize: 12, color: TOKEN.faint, fontVariantNumeric: "tabular-nums" }}>
          {shortTime(decision.at)}
          {decision.mode === "dry-run" ? " · dry run" : ""}
        </span>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <Confidence tier={decision.tier} confidence={decision.confidence} />
        <span
          style={{ fontSize: 12, color: TOKEN.faint, fontFamily: TOKEN.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "42ch" }}
          title={decision.taskKey}
        >
          {decision.taskKey}
        </span>
      </div>

      {decision.note ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: TOKEN.warn,
            background: TOKEN.raised,
            border: `1px solid ${TOKEN.border}`,
            borderRadius: 6,
            padding: "6px 10px",
          }}
        >
          {decision.note}
        </div>
      ) : null}

      {decision.signals.length > 0 ? (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
          {decision.signals.map((signal) => (
            <span
              key={signal}
              style={{
                fontSize: 11,
                color: TOKEN.muted,
                background: TOKEN.soft,
                border: `1px solid ${TOKEN.border}`,
                borderRadius: 5,
                padding: "2px 7px",
                fontFamily: TOKEN.mono,
              }}
            >
              {signal}
            </span>
          ))}
        </div>
      ) : null}

      {skips.length > 0 ? (
        <div style={{ marginTop: 12, borderTop: `1px solid ${TOKEN.border}`, paddingTop: 10 }}>
          <div style={{ ...label, marginBottom: 6 }}>Passed over</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {skips.map(([memberId, reason]) => (
              <div key={memberId} style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: 10, alignItems: "baseline" }}>
                <span
                  style={{ fontFamily: TOKEN.mono, fontSize: 11.5, color: TOKEN.muted, whiteSpace: "nowrap" }}
                  title={memberId}
                >
                  {decision.labels?.[memberId] ?? memberId}
                </span>
                <span style={{ fontSize: 12.5, color: TOKEN.text, lineHeight: 1.5 }}>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  )
}

/**
 * The explanation surface. Paperclip OSS does not render the router's skipped
 * reasons anywhere, so this page is where a person can see why a pool member
 * won, and why the others did not. Server-renderable for tests; no host imports.
 */
export function DecisionsView({ data }: { data: DecisionsPayload | undefined }) {
  const decisions = data?.decisions ?? []

  return (
    <section
      style={{
        fontFamily: "inherit",
        color: TOKEN.text,
        background: TOKEN.bg,
        padding: "28px 24px 40px",
        maxWidth: 880,
        fontSize: 13,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Mark />
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 650, letterSpacing: "-0.01em" }}>Smart Router</span>
          <span style={{ ...label, fontSize: 9.5 }}>For Paperclip</span>
        </div>
      </header>
      <div style={{ height: 2, borderRadius: 2, background: BRAND, width: 44, marginTop: 14, marginBottom: 18 }} />

      {decisions.length === 0 ? (
        <div
          style={{
            border: `1px dashed ${TOKEN.strong}`,
            borderRadius: 8,
            padding: "22px 20px",
            background: TOKEN.raised,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>No decisions yet</div>
          <div style={{ color: TOKEN.muted, lineHeight: 1.6, maxWidth: "62ch" }}>
            Point an agent at a Smart Router pool and the next task will appear here: the member that was chosen, the
            task tier it was chosen for, and the reason every other member was passed over.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <span style={{ ...label }}>Recent decisions</span>
            <span style={{ fontSize: 12, color: TOKEN.faint }}>
              {decisions.length} {decisions.length === 1 ? "decision" : "decisions"}, newest first
            </span>
          </div>
          <ul style={{ display: "flex", flexDirection: "column", gap: 10, margin: 0, padding: 0 }}>
            {decisions.map((decision, index) => (
              <DecisionCard key={`${decision.at}-${decision.taskKey}-${index}`} decision={decision} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
