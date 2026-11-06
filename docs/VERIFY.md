# Verification run, 2026-11-06

Instance: the maintainer's local Paperclip `2026.1023.0`, `local_trusted` mode, server already running on `127.0.0.1:3100` (PID reused, not started for this test). No connected AI accounts exist on this instance, so a real pool allocation could not be exercised. Everything else was verified live.

## What was verified

| Check | Result |
|---|---|
| Plugin installs from a local path | `paperclipai plugin install .` reports `Installed qadan.paperclip-router v0.1.0 (ready)` |
| Plugin status in the API | `status: ready`, `lastError: null` |
| Router descriptor registered | `manifestJson.aiConnectionRouter` present |
| Connectors catalog | "Smart Router pool" appears under Connectors with the description and an **Add connection pool** action |
| Instance flag | `PATCH /api/instance/settings/experimental` with `enableAiConnectionRouters: true` returns the flag on |
| Decisions page | `/:companyPrefix/router` renders inside Paperclip with the empty state |
| Page data path | `ctx.data.register("decisions")` responds through the UI bridge, no console errors from the plugin |

## Hook behavior, driven through the built worker with the host request shape

Commands: `/tmp/simulate-route.mjs` (kept out of the repo, it is a one-off harness). Results:

- **Architecture task, two members:** selected the frontier member with `cheap: "model tier 1 is below the tier 3 floor for architecture work"` as the stated reason.
- **Mechanical task with the cheap member blocked:** selected the strong member with `cheap: "Weekly limit reached"`.
- **Pinned member, blocked:** returned the pinned member with no skips, as the host requires.
- **Every observed member blocked:** returned `exhausted` with `retryAt` equal to the earliest real reset (`2026-11-10T19:05:12Z` in the run).
- **State writes:** confirmed the hook queues its decision write and answers first; the write drains after.

## What was not verified

- A live task allocation through a real pool, because no accounts are connected on this instance. To close that gap: connect two accounts, create a `usage_aware` pool with members on different model tiers, point an agent at it, and run one mechanical and one architecture task.
- Failure memory against a real provider rejection. The classification and the state path are unit tested and exercised through the worker; the event join needs a real failed run.
