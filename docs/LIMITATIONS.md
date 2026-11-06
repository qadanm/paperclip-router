# Limitations

Host constraints, not defects. Every one is visible in the product rather than silent.

## Pinned tasks keep their member

Paperclip pins a task to the member chosen at its first run and does not release the pin on failure. The router cannot reroute a pinned task; it chooses members for new tasks. When a pinned member keeps failing, the page shows it as held back and names the member; unpin or reassign the task in Paperclip.

## Usage is only visible for some providers

Paperclip reports subscription usage for its first-class subscription providers (Anthropic, OpenAI, xAI) and for OpenRouter. Generic gateways connected through the Chat Completions connector (Command Code, OpenDesign, a self-hosted router) report none.

When usage is absent the router runs in its fallback mode: task tier, fairness, and rejection memory. The page shows tier and confidence, and never invents a window percentage. This is stated on the page, not hidden.

## One model per member

A pool member is one account with one model, and a connection can appear once per pool. Choosing a model means choosing the member that has it; the router cannot switch models inside an account.

## The tier floor is a preference

When no member reaches the tier floor for a task, the router uses the nearest and records the deviation on the decision. It will not fail a task to protect a rule, because a pool of unfamiliar model names would then never route.

## Model names are free text

Tier assignment uses a seeded table plus your overrides. Unknown models are tier 2 with a note. Nothing is silently excluded.

## Skip reasons are not rendered by Paperclip's own UI

Paperclip does not display a router's skip reasons, so this plugin ships its own page. That page is the explanation surface.

## Rejection detection reads text

Paperclip's run failure event carries a message and a coarse code, not a structured provider category. Classification is deliberately narrow, and outages, rate limits, auth failures, and billing failures never count against a member. A missed deterministic rejection costs one retry; a false positive would bench a healthy account, so the bias is toward missing.

## Alpha plugin SDK

The plugin pins `@paperclipai/plugin-sdk` and `@paperclipai/shared` exactly. Expect to re-pin on Paperclip upgrades, and re-check the router hook contract when you do.

## Dark theme is untested visually

The page reads Paperclip's CSS tokens for every surface and falls back to light values only where a token is missing, so it should follow any theme. It was built and reviewed in the host's light theme; dark mode was not captured against a live dark session.
