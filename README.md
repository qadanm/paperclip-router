# Smart Router for Paperclip

A router plugin for [Paperclip](https://paperclip.ing). Paperclip gives an agent a **pool** of AI accounts. This plugin decides which account and model each new task gets, and writes down why.

Paperclip ships rotation. This replaces it with a decision.

## What it looks at

**The task, classified locally.** A weighted read of the issue title and description, across scope, architecture, security, debugging, design, constraints and imperatives. No model call, no network, under a millisecond.

**How firm that read is.** The classifier returns a confidence derived from how close the task sits to a tier boundary. `tier 2 · borderline` means the task could reasonably have been tier 1 or 3; the page says so instead of pretending certainty.

**Allowance, when the host can see it.** Where Paperclip reports subscription usage for an account, allowance that resets soon is cheaper to spend, because the alternative is losing it. Where it cannot (generic gateways report no usage), the router says so and routes on tier, fairness and memory instead. It never reads missing usage as healthy, and never as exhausted.

**Recent rejections.** A member that produced a deterministic request rejection is held back for new tasks on that task signature. Outages, rate limits, auth failures and billing failures never count against a member.

**Fairness.** Ties rotate through the pool rather than pinning every task to the first account.

## What it writes down

Every decision lands on a **Smart Router** page inside Paperclip: the member that was chosen with its model, the task tier, how confident that tier was, and a plain sentence for every member that was passed over. Paperclip's own UI does not render a router's skip reasons, so the plugin carries its own page. It follows the host theme, light or dark.

The page is the product. If the router cannot explain a choice, the choice should not be made.

## What it will not do

- **Reroute a task Paperclip has already pinned.** Pinning is the host's session-continuity rule. If a pinned member keeps failing, the page tells you; unpin or reassign the task.
- **Switch models inside an account.** A pool member is one account with one model. Choosing a model means choosing the member that has it.
- **Fail a task to protect a rule.** When no member reaches the tier floor, the router uses the nearest and records the deviation. A pool with unknown model names still routes.
- **Return `exhausted` on a guess.** That result defers the task until a reset time, so it is only returned when every candidate's usage was observed and blocked.

## Install

```bash
npx paperclipai plugin install @qadanm/paperclip-router
```

Then: enable **AI connection routing** for the instance, open **Connectors**, add a **Smart Router pool**, and point an agent's **AI connection** at it. `docs/INSTALL.md` has the full path, including how to connect a gateway that is not in Paperclip's catalog.

## Gateways

Paperclip's connector catalog covers Anthropic, OpenAI, OpenRouter, Grok, Gemini and Bedrock. Any other OpenAI-compatible gateway (Command Code, OpenDesign, a self-hosted router) connects through **Chat Completions API**: base URL, protocol `chat`, bearer token. Those connections report no subscription usage, which the router states on the page.

## Configuration

Settings, per company:

| Setting | Default | Meaning |
|---|---|---|
| Dry run | off | Record decisions, return Paperclip's reference rotation. Use it for a week to compare. |
| Safety margin | 85 | Skip a member whose weakest window is past this when another has room. |
| Hold a rejecting member back | 30 minutes | How long a deterministic rejection keeps a member out of new tasks. |
| Weight for expiring allowance | 1 | How strongly a soon-to-reset window discounts a member. |
| Model tier floor | 1 / 2 / 3 | The model tier each task tier requires. |
| Model tier overrides | seeded | Add tiers for models the plugin does not know. Unknown models are tier 2. |

## Development

```bash
pnpm install && pnpm test && pnpm run build
```

The decision core in `src/core/` imports nothing from the host and is tested on its own: `classify` (weighted task tiers with confidence), `windows` (usage to a cost proxy or an honest unknown), `score` (ranking and every skip reason), `decide` (pinned, unavailable, exhausted), `store` and `failures` (bounded history and rejection memory).

The classifier and failure handling were designed against two MIT routers, [ClawRouter](https://github.com/BlockRunAI/ClawRouter) and [LLMRouter](https://github.com/ulab-uiuc/LLMRouter), taking their weighted-dimension scoring and confidence model, and deliberately fixing their flat simplicity penalty and retry-the-same-model behavior. `docs/DESIGN.md` records the reasoning.

MIT.
