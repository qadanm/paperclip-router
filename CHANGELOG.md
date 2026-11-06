# Changelog

## 0.3.0 (2026-11-06)

The page was rebuilt from the ground up: new layout, new type scale, new color
system, and the real logo. The previous version worked but looked like a stack of
cards, and in dark mode it was white.

### Added

- **The product's real logo, at native proportions.** The mark is the shipped
  artwork from Smart Router's own `logo.svg`: one node fanning into three lanes
  ending in three rounded terminals. Same silhouette across both products.
- **A proper lockup.** Mark, wordmark, and the product line in spaced caps, which
  is the arrangement the logo itself uses.
- **Pool standing as a table.** Account, standing, how often chosen, when last
  used, with each account's share of decisions. Held-back rows state when the
  member returns.
- **Task titles on decisions.** Rows are led by the task that was routed, because
  that is what a person recognises; the account and model sit underneath as the
  answer. Records written before titles existed are resolved at read time from the
  host, so old rows stop showing a bare UUID. Nothing is rewritten in storage.
- **Expandable reasoning.** Every decision is a native `<details>` disclosure, so
  keyboard, screen reader, and text selection work without custom handlers. Inside:
  the deviation note, every member passed over with its reason, the classifier
  signals in plain words, and the tier confidence.
- **Real loading, error, and empty states.** The skeleton reserves the layout
  instead of shifting it. An error says routing is unaffected, because it is. The
  empty state lists the three steps that produce a first decision.
- **Truncation with an explicit reveal.** Eight rows, then "Show all N". The full
  history does not arrive as one wall.

### Changed

- **The color system is Paperclip's.** Every structural color reads the host's
  tokens (`--background`, `--foreground`, `--card`, `--muted`, `--border`,
  `--radius`). A `<style>` block carries the states inline styles cannot: row
  hover, focus rings, the rotating chevron, selection color, breakpoints.
- **Brand values are chosen per theme by measured contrast.** Light keeps the
  package pair (teal `#0f766e`, cyan `#0891b2`). Dark promotes the same hues to
  mint `#2dd4bf` and ice `#67e8f9`, because the light pair measures 3.3:1 on
  Paperclip's dark surface. Text and graphics clear 4.5:1 and 3:1 in both.
- **Depth in dark mode comes from a lifted surface.** Paperclip's `--card` equals
  `--background` in dark, so a card on the page had no edge. The surface is lifted
  3 percent and separated by hairline rules.
- **Tier is drawn as an ordinal**: three segments, filled as far as the task
  requires, with "borderline" when confidence is under 0.7.
- **Relative time leads, exact time is the tooltip.** "38 min ago" answers the
  question; the timestamp is still one hover away.
- **Type is tabular wherever numbers stack**, so counts and times line up.

### Fixed

- **The page was white in dark mode.** It read `--v2-*` tokens, which belong to a
  different app entirely; every lookup missed and the fallbacks were light. A test
  now asserts the markup contains no `--v2-` reference and no literal white
  surface.
- **Decision rows lost their separators.** Each row is its own `<details>`, so a
  sibling selector could not reach it; the wrapper carries the rule now.
- **Table headers were off-grid** on the decisions table and wrapped to two lines.

## 0.2.0 (2026-11-06)

The release where the page became the product.

### Added

- **Member state on the page.** Every member the router knows about, with its
  model, how many decisions it has served, when it last served one, and whether
  it is ready or held back. Held-back members sort first, because they are the
  actionable rows, and the row says when the member becomes eligible again.
  Derived from decisions and failure memory at read time, so it cannot drift.
- **Read-time repair of older records.** Decisions recorded before labels and
  confidence existed are enriched from newer records, so an older decision shows
  `claude-sonnet-5-5 · codex` instead of a UUID. Storage is untouched. The page
  says how many rows it repaired.
- **Deviation notes.** When no member reaches the tier floor, the router uses the
  nearest and states the deviation on the decision, rather than failing the task
  or mislabelling the chosen member as passed over.

### Changed

- The page follows the host's theme. It reads Paperclip's CSS tokens with
  fallbacks, so light, dark, and custom themes all render correctly. The previous
  version hardcoded a dark palette and was unreadable in the default light theme.
- Decision records carry a label per member (`model · provider`) alongside the id.
  Ids remain for correlation and appear only as tooltips.
- The UI data handler returns member state in the same payload as decisions.

### Fixed

- The chosen member could appear under "passed over" on the same decision, with
  the floor-deviation reason that explained the choice. It no longer does.
- Only the last below-floor member received a reason; now every one does.
- The worker bundle inlined `@paperclipai/plugin-sdk` and a second copy of
  `effect`, producing a 1.8 MB worker. The SDK is external (the host provides it),
  so the worker ships at 27 KB.

## 0.1.0 (2026-11-06)

First cut: weighted task classification with confidence, window-aware scoring,
member ranking with a stated reason for every skip, deterministic-rejection
memory, pinned-safe routing, and the decisions page.
