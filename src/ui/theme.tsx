/**
 * The page's visual system.
 *
 * Two rules govern this file:
 *
 * 1. Color comes from Paperclip. Everything structural reads the host's own
 *    tokens (`--background`, `--foreground`, `--card`, `--muted-foreground`,
 *    `--border`, `--radius`), so light, dark, and any host theme apply without a
 *    media query. An earlier build read `--v2-*` tokens, which belong to a
 *    different app; every lookup missed, the fallbacks were white, and the page
 *    rendered white in dark mode.
 *
 * 2. The mark is the product's real logo, not a redrawing. The geometry below is
 *    ported from the shipped `logo.svg`: one node feeding a fan of three lanes
 *    into three rounded terminals, which is what the router does (one task, three
 *    model tiers). Nothing here is approximated.
 *
 * The brand pair is the one already on the package: teal #0f766e to cyan
 * #0891b2. On Paperclip's dark surface that pair measures 3.3:1, too dim for a
 * 3px stroke, so dark mode promotes the same hue family to #2dd4bf to #67e8f9
 * (9.6:1 and 12.6:1). Same brand, corrected for the surface it sits on.
 */

export const brand = {
  light: { from: "#0f766e", to: "#0891b2", ink: "#115e59", rule: "#0e7490" },
  dark: { from: "#2dd4bf", to: "#67e8f9", ink: "#7ff0dd", rule: "#2dd4bf" },
} as const

/**
 * The Smart Router mark, at the logo's own proportions.
 *
 * Source geometry: circle at (10, 44) r 4.6, stem to (36, 44), then three lanes
 * fanning to terminals at x 72..84, y 14 / 38 / 62, stroke 3.2 round. The view box
 * is shifted up 12 units so the artwork is optically centred at any size.
 */
export function BrandMark({ height = 26, title }: { height?: number; title?: string | undefined }) {
  const width = Math.round((height * 84) / 62)
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 88 64"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="sr-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--sr-from)" />
          <stop offset="100%" stopColor="var(--sr-to)" />
        </linearGradient>
      </defs>
      <g stroke="url(#sr-mark)" strokeWidth="3.2" strokeLinecap="round">
        <path d="M14 32h22" />
        <path d="M36 32c10 0 12-22 22-22h14" />
        <path d="M36 32c10 0 12 22 22 22h14" />
        <path d="M36 32h36" />
      </g>
      <circle cx="10" cy="32" r="4.6" fill="url(#sr-mark)" />
      <g fill="url(#sr-mark)">
        <rect x="72" y="2" width="12" height="12" rx="3" />
        <rect x="72" y="26" width="12" height="12" rx="3" />
        <rect x="72" y="50" width="12" height="12" rx="3" />
      </g>
    </svg>
  )
}

/**
 * One stylesheet for the page.
 *
 * A `<style>` element rather than inline styles, because the things that make an
 * interface feel built live in states inline styles cannot express: row hover,
 * focus rings, the rotating disclosure chevron, selection color, breakpoints.
 * Every class is prefixed `sr-` so nothing leaks into the host.
 */
export const pageCss = `
.sr-page {
  --sr-from: ${brand.light.from};
  --sr-to: ${brand.light.to};
  --sr-brand: ${brand.light.rule};
  --sr-brand-ink: ${brand.light.ink};
  --sr-surface: var(--card);
  --sr-raise: color-mix(in oklab, var(--foreground) 3%, var(--background));
  --sr-wash: color-mix(in oklab, ${brand.light.rule} 7%, var(--background));
  --sr-track: color-mix(in oklab, var(--foreground) 14%, transparent);
  --sr-hover: color-mix(in oklab, var(--foreground) 4%, transparent);
  --sr-rule: var(--border);
  --sr-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  box-sizing: border-box;
  min-height: 100%;
  padding: 4px 24px 56px;
  color: var(--foreground);
  background: var(--background);
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.dark .sr-page {
  --sr-from: ${brand.dark.from};
  --sr-to: ${brand.dark.to};
  --sr-brand: ${brand.dark.rule};
  --sr-brand-ink: ${brand.dark.ink};
  /* --card equals --background in Paperclip's dark theme, so a card on the page
     background has no edge at all. Lift it by a hair instead. */
  --sr-surface: var(--sr-raise);
  --sr-wash: color-mix(in oklab, ${brand.dark.rule} 10%, var(--background));
  --sr-track: color-mix(in oklab, var(--foreground) 18%, transparent);
  --sr-hover: color-mix(in oklab, var(--foreground) 6%, transparent);
}
.sr-page *, .sr-page *::before, .sr-page *::after { box-sizing: border-box; }
.sr-page ::selection { background: color-mix(in oklab, var(--sr-brand) 30%, transparent); }
.sr-inner { max-width: 1000px; }

.sr-num { font-variant-numeric: tabular-nums; }
.sr-mono { font-family: var(--sr-mono); font-size: 11px; }
.sr-muted { color: var(--muted-foreground); }
.sr-sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* Masthead. The lockup mirrors the logo: mark, wordmark, then the product line in
   spaced caps. Identity left, current state right. */
.sr-masthead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 0 16px;
  border-bottom: 1px solid var(--sr-rule);
  flex-wrap: wrap;
}
.sr-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.sr-lockup { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.sr-wordmark {
  font-size: 16px;
  font-weight: 630;
  letter-spacing: -0.019em;
  line-height: 1.2;
  color: var(--foreground);
  white-space: nowrap;
}
.sr-attribute {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.185em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  line-height: 1.3;
  white-space: nowrap;
}
.sr-live { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.sr-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 21px;
  padding: 0 8px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--sr-brand-ink);
  background: var(--sr-wash);
  border: 1px solid color-mix(in oklab, var(--sr-brand) 34%, transparent);
  border-radius: 999px;
  white-space: nowrap;
}
.sr-chip-quiet {
  color: var(--muted-foreground);
  background: transparent;
  border-color: var(--sr-rule);
}
.sr-chip-dot { width: 5px; height: 5px; border-radius: 999px; background: currentColor; }

/* Sections: a small caps label with its count set quietly on the same line, which
   is how the host's own settings panes title their groups. */
.sr-section { margin-top: 24px; }
.sr-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.sr-label {
  margin: 0;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.sr-count { font-size: 11.5px; color: var(--muted-foreground); font-variant-numeric: tabular-nums; }

/* One bordered plane with hairline separators. Cards per row would be noise; a
   table reads as a ledger, which is what this is. */
.sr-table {
  border: 1px solid var(--sr-rule);
  border-radius: calc(var(--radius) + 1px);
  background: var(--sr-surface);
  overflow: hidden;
}
.sr-tr { display: grid; align-items: center; gap: 14px; padding: 9px 13px; }
.sr-tr-head {
  padding: 6px 13px;
  background: color-mix(in oklab, var(--muted) 55%, transparent);
  border-bottom: 1px solid var(--sr-rule);
}
.sr-tr-head > * {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.075em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  white-space: nowrap;
}
.sr-members .sr-tr,
.sr-members .sr-tr-head { grid-template-columns: minmax(0, 1.6fr) 100px 84px 104px; }

.sr-member-name {
  font-size: 12.5px;
  font-weight: 550;
  letter-spacing: -0.006em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sr-sub { font-size: 11px; color: var(--muted-foreground); margin-top: 1px; line-height: 1.45; }
.sr-standing { font-size: 11.5px; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.sr-stand-ok { color: var(--muted-foreground); }
.sr-stand-held { color: var(--sr-brand-ink); font-weight: 550; }
.sr-dot { width: 5px; height: 5px; border-radius: 999px; background: currentColor; flex-shrink: 0; }
.sr-stand-ok .sr-dot { background: color-mix(in oklab, var(--foreground) 32%, transparent); }

/* Decisions. Each row is a native disclosure: keyboard, screen reader, and text
   selection work without a single custom key handler. */
.sr-row { border-top: 1px solid var(--sr-rule); }
.sr-row:first-of-type { border-top: none; }
.sr-decisions .sr-summary,
.sr-decisions .sr-tr-head { grid-template-columns: 15px minmax(0, 1fr) 124px 86px; }
.sr-decisions .sr-summary {
  cursor: pointer;
  list-style: none;
  transition: background-color 110ms ease-out;
}
.sr-decisions .sr-summary::-webkit-details-marker { display: none; }
.sr-decisions .sr-summary::marker { content: ""; }
.sr-summary:hover { background: var(--sr-hover); }
.sr-summary:focus-visible { outline: 2px solid var(--sr-brand); outline-offset: -2px; }
.sr-chev { color: var(--muted-foreground); display: flex; align-items: center; }
.sr-chev svg { display: block; transition: transform 130ms ease-out; }
details[open] > .sr-summary .sr-chev svg { transform: rotate(90deg); }
details[open] > .sr-summary { background: var(--sr-hover); border-bottom: 1px solid var(--sr-rule); }

.sr-chosen { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
.sr-chosen-task {
  font-size: 12.5px;
  font-weight: 550;
  letter-spacing: -0.006em;
  color: var(--foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sr-chosen-task.is-none { color: var(--muted-foreground); font-weight: 500; }
.sr-chosen-meta {
  font-size: 11px;
  color: var(--muted-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}
.sr-sep { color: var(--muted-foreground); opacity: 0.55; }
.sr-ref { font-family: var(--sr-mono); font-size: 10.5px; letter-spacing: -0.01em; }

/* Tier is an ordinal, so it is drawn as one: three segments, filled as far as the
   task's requirement reaches. */
.sr-tier { display: inline-flex; align-items: center; gap: 7px; }
.sr-meter { display: flex; gap: 2px; }
.sr-meter i { width: 8px; height: 3px; border-radius: 1px; background: var(--sr-track); display: block; }
.sr-meter i.on { background: var(--sr-brand); }
.sr-tier-text { font-size: 11px; color: var(--muted-foreground); white-space: nowrap; letter-spacing: -0.002em; }
.sr-when { font-size: 11.5px; color: var(--muted-foreground); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }

.sr-detail { padding: 0 13px 13px 42px; background: var(--sr-hover); }
.sr-detail-inner { padding-top: 2px; display: flex; flex-direction: column; gap: 12px; }
.sr-detail-label {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.085em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  margin-bottom: 4px;
}
.sr-skip { display: grid; grid-template-columns: minmax(0, max-content) minmax(0, 1fr); gap: 3px 12px; align-items: baseline; }
.sr-skip-name { font-family: var(--sr-mono); font-size: 10.5px; color: var(--foreground); white-space: nowrap; }
.sr-skip-why { color: var(--muted-foreground); font-size: 12px; line-height: 1.5; }
.sr-signals { display: flex; flex-wrap: wrap; gap: 4px; }
.sr-signal {
  font-family: var(--sr-mono);
  font-size: 10px;
  color: var(--muted-foreground);
  border: 1px solid var(--sr-rule);
  border-radius: 4px;
  padding: 1px 6px;
  white-space: nowrap;
}
.sr-note {
  margin: 0;
  font-size: 11.5px;
  color: var(--muted-foreground);
  line-height: 1.55;
  border-left: 2px solid color-mix(in oklab, var(--sr-brand) 60%, transparent);
  padding-left: 9px;
}

.sr-more {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; margin-top: 8px; padding: 7px 12px;
  font-size: 12px; font-weight: 500; color: var(--foreground);
  background: transparent; border: 1px solid var(--sr-rule);
  border-radius: var(--radius); cursor: pointer;
  transition: background-color 110ms ease-out;
}
.sr-more:hover { background: var(--sr-hover); }
.sr-more:focus-visible { outline: 2px solid var(--sr-brand); outline-offset: 2px; }

.sr-empty {
  border: 1px solid var(--sr-rule);
  border-radius: calc(var(--radius) + 1px);
  background: var(--sr-surface);
  padding: 20px 18px;
}
.sr-empty-title { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 4px; }
.sr-empty-body { color: var(--muted-foreground); font-size: 12.5px; line-height: 1.6; max-width: 62ch; }
.sr-empty-steps { margin: 12px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 5px; }
.sr-empty-steps li {
  display: grid; grid-template-columns: 15px 1fr; gap: 8px;
  font-size: 12px; color: var(--muted-foreground); align-items: baseline;
}
.sr-step-n { font-variant-numeric: tabular-nums; font-size: 10px; font-weight: 700; color: var(--sr-brand-ink); }

.sr-foot {
  margin-top: 18px;
  font-size: 11px;
  color: var(--muted-foreground);
  line-height: 1.6;
  max-width: 78ch;
}

.sr-skeleton { display: flex; flex-direction: column; gap: 7px; }
.sr-skeleton-row {
  height: 36px; border-radius: calc(var(--radius) + 1px);
  border: 1px solid var(--sr-rule);
  background: color-mix(in oklab, var(--muted) 40%, transparent);
}

@media (max-width: 860px) {
  .sr-members .sr-tr, .sr-members .sr-tr-head { grid-template-columns: minmax(0, 1fr) 92px 84px; }
  .sr-members .sr-tr-head > :nth-child(4), .sr-members .sr-tr > :nth-child(4) { display: none; }
  .sr-decisions .sr-summary, .sr-decisions .sr-tr-head { grid-template-columns: 15px minmax(0, 1fr) 112px; }
  .sr-decisions .sr-tr-head > :nth-child(4), .sr-decisions .sr-summary > :nth-child(4) { display: none; }
}
@media (max-width: 620px) {
  .sr-page { padding: 0 16px 44px; }
  .sr-members .sr-tr, .sr-members .sr-tr-head { grid-template-columns: minmax(0, 1fr) 86px; }
  .sr-members .sr-tr-head > :nth-child(3), .sr-members .sr-tr > :nth-child(3),
  .sr-members .sr-tr-head > :nth-child(4), .sr-members .sr-tr > :nth-child(4) { display: none; }
  .sr-decisions .sr-summary, .sr-decisions .sr-tr-head { grid-template-columns: 15px minmax(0, 1fr); }
  .sr-decisions .sr-tr-head > :nth-child(3), .sr-decisions .sr-summary > :nth-child(3) { display: none; }
  .sr-detail { padding-left: 13px; }
  .sr-attribute { letter-spacing: 0.14em; }
}
@media (prefers-reduced-motion: reduce) {
  .sr-page *, .sr-page *::before, .sr-page *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
`
