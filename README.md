# Smart Router for Paperclip

A connection-pool router plugin for [Paperclip](https://paperclip.ing). It replaces round-robin account allocation with a decision that accounts for the task and the allowance behind each account.

## What it does

Paperclip lets an agent use a pool of saved AI accounts. Each member of the pool is an account, a harness, and a model. This plugin picks the member for each new task using:

- **Task class.** Mechanical work, docs, and tests go to the economy member; architecture, security, and hard debugging go to the member whose model meets the floor for that tier. Classification is local and deterministic, from the task title and description.
- **Usage windows.** When Paperclip reports subscription usage for a member, allowance that resets soon is cheaper to spend, because the alternative is losing it. Allowance that resets late costs full price. Members with an observed limit reached are skipped, with the reason shown on the page.
- **Recent rejections.** A member that produced a deterministic request rejection is held back for new tasks for thirty minutes. Outages and rate limits never count against a member.
- **Fairness.** Ties rotate through the pool instead of pinning every task to the first account.

Every decision appears on a Smart Router page in Paperclip: the chosen member, the task, and the reason each other member lost.

## What it does not do

- It does not reroute a task that Paperclip has already pinned to a member. Pinning is the host's session-continuity rule, and the plugin respects it. If a pinned member keeps failing, the page tells you; unpin or reassign the task.
- It cannot switch models inside an account. A pool member is one account with one model, so choosing a model means choosing the member that has it.
- The model tier floor is a preference, not a veto. When no member reaches the floor for a task (for example, a pool made only of models the plugin does not know), the router still picks the nearest tier and records the deviation instead of failing the task.
- Paperclip only probed usage for pools in `usage_aware` mode with a responsible user on the run. When usage is not observed, the router falls back to task tier and fairness, and says so on the page. It never reads missing usage as healthy, and never as exhausted.

## Requirements

- Paperclip with the `enableAiConnectionRouters` experimental flag on.
- Node 24.11 or newer on the Paperclip host.

## Install

```bash
npx paperclipai plugin install @qadanm/paperclip-router
```

Or install by package name from **Settings → Plugins**. Then:

1. Turn on AI connection routing for the instance.
2. Open **Connectors** and add a **Smart Router pool**.
3. Pick the accounts you want in the pool and set each member's model.
4. Point an agent's **AI connection** at the pool.

`docs/INSTALL.md` has the exact steps and the API equivalents.

## Configuration

Settings → Plugins → Smart Router:

| Setting | Default | Meaning |
|---|---|---|
| Dry run | off | Record decisions but keep Paperclip's reference rotation. Use it for a week to compare. |
| Safety margin | 85 | A member whose weakest window is past this percentage is skipped when another member can serve the task. |
| Hold a rejecting member back | 30 minutes | How long a deterministic rejection keeps a member out of new tasks. |
| Weight for expiring allowance | 1 | How strongly a soon-to-reset window discounts a member. |
| Model tier floor per task tier | 1 / 2 / 3 | Which model tier each task tier requires. |
| Model tier overrides | seeded | Add tiers for models the plugin does not know. Unknown models are tier 2. |

## Development

```bash
pnpm install
pnpm test
pnpm run build
```

The decision core in `src/core/` has no host imports and is tested independently:

- `classify` maps a task to a kind and tier.
- `windows` turns usage observations into a cost proxy or an honest unknown.
- `score` ranks members and explains every skip.
- `decide` applies the pinned, unavailable, and exhausted rules.
- `store` and `failures` keep the bounded decision ring and rejection memory.

MIT.
