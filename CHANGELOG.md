# Changelog

## 0.2.0 — 2026-11-06

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

## 0.1.0 — 2026-11-06

First cut: weighted task classification with confidence, window-aware scoring,
member ranking with a stated reason for every skip, deterministic-rejection
memory, pinned-safe routing, and the decisions page.
