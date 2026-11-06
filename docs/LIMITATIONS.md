# Limitations

These are host constraints, not bugs. They are stated here so nothing is a surprise in use.

- **Pinned tasks keep their member.** Paperclip pins a task to the member chosen at its first run and never releases the pin on failure. The router cannot reroute a pinned task; it can only choose members for new tasks. If a pinned member keeps failing, unpin or reassign the task in Paperclip.
- **Usage needs a human context.** Paperclip attaches usage observations only for `usage_aware` pools whose run has a responsible user. Autonomous and routine runs may have none. The router falls back to tier, fairness, and rejection memory, and notes it on the page. It cannot probe usage itself: plugins have no credentials.
- **One model per member.** A member is an account plus a harness plus a model, and a connection can appear once per pool. The router chooses among configured (account, model) pairs; it cannot switch models inside an account.
- **Model names are free text.** Tier classification uses a seeded table plus your overrides. Unknown models are tier 2 with a note, never silently excluded.
- **Skip reasons are not rendered by Paperclip.** The router returns them, but OSS Paperclip does not display them today. They appear on the Smart Router page instead.
- **Alpha plugin SDK.** The plugin pins `@paperclipai/plugin-sdk` and `@paperclipai/shared` exactly. Expect to re-pin on Paperclip upgrades.
- **Rejection detection reads text.** Paperclip's run failure event carries a message and a coarse code, not a structured provider category. Classification is deliberately narrow; outages, rate limits, auth failures, and quota failures never count against a member.
