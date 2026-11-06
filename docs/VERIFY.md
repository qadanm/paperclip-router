# Verification run, 2026-11-06

Instance: the maintainer's local Paperclip `2026.1023.0`, `local_trusted` mode, port 3100. Real providers only: **OpenDesign Pro** (`amr-link.open-design.ai/v1`) and **Command Code GOAT** (`api.commandcode.ai/provider/v1`), both connected with the keys already on this machine and both reporting `connected`.

## What was verified end to end

| Check | Result |
|---|---|
| Plugin installs from a local path | `paperclipai plugin install .` → `Installed qadan.paperclip-router v0.1.0 (ready)` |
| Plugin status | `status: ready`, `lastError: null` |
| Router descriptor registered | `manifestJson.aiConnectionRouter` present |
| Connectors catalog | "Smart Router pool" listed with **Add connection pool** |
| Instance flag | `enableAiConnectionRouters: true` accepted |
| Two real gateways connected | OpenDesign Pro and Command Code GOAT, both `connected` |
| Pool created against the plugin | `Smart Router`, mode `usage_aware`, 2 members, enabled |
| Agent bound to the pool | `runtimeConfig.aiConnection = { mode: "router", connectionId: <pool> }` |
| Heartbeat invoked | run queued by `paperclipai agent heartbeat:invoke` |
| **Pool allocation happened** | `ai_connection.pool_selected` in the company activity log |
| **Router chose the correct member** | member `22222222…` (Command Code, `claude-sonnet-5-5`) |
| Decisions page inside Paperclip | renders the decision, the chosen member, the skip reason, tier and confidence |

The page, live, showed:

```
22222222-2222-4222-8222-222222222222  lifecycle:1606a2ea…  01:13 PM  tier 2 · borderline, nearest tier
22222222-2222-4222-8222-222222222222  lifecycle:1606a2ea…  01:12 PM  tier 2 · borderline, nearest tier
11111111-1111-4111-8111-111111111111  → "model tier 1 is below the tier 2 floor for unknown work"
```

That last line is the router refusing the economy member because the task scored at tier 2, which is the whole point of the feature.

## What this also settled

- **Generic gateways work.** Neither Command Code nor OpenDesign is in Paperclip's connector catalog. Both were connected through the generic `chat-completions-api` connector with `kind: "gateway"`, `protocol: "chat"`, `auth: "bearer"`. That is the recipe for any OpenAI-compatible gateway, so a user is not limited to Paperclip's first-class providers.
- **Usage stays unknown for these gateways**, exactly as the design predicted. `usageProbeSupported: false` on both connections, so the router runs in its fallback mode: tier, fairness, failure memory. The page says "tier 2" rather than inventing window numbers.
- **The hook answers inside the host budget.** Allocation completed and the run queued normally; no `ConfigurationIncompleteFailure`.

## Not verified

- A completed model call through the chosen member. The heartbeat run queued but did not start within the check window, and Command Code returns a Cloudflare 1010 challenge to non-browser clients, so a scripted turn cannot be forced through. Allocation, selection, skip reasons, and the page are all proven; the model round trip is the host's own adapter path.
- Failure memory against a real provider rejection, for the same reason: it needs a failed run, not a scripted call.

## How to reproduce

1. Connect a gateway: Connectors → **Chat Completions API** → Provider URL = the gateway base, API format = Chat Completions, Authentication = Bearer token, paste the key.
2. Connectors → **Smart Router pool** → Add connection pool → pick the connected accounts → set each member's model → enable.
3. Agent settings → AI connection → the pool.
4. Open the **Smart Router** page and run a task. The decision appears with the member and the reasons.
