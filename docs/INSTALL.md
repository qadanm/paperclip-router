# Install

## 1. Turn on connection routing

Router plugins only load while instance-wide AI connection routing is enabled. As an instance administrator:

```bash
curl -X PATCH https://YOUR-PAPERCLIP-HOST/api/instance/settings/experimental \
  -H "Content-Type: application/json" \
  -d '{"enableAiConnectionRouters": true}'
```

## 2. Install the plugin

```bash
npx paperclipai plugin install @qadanm/paperclip-router
```

Or **Settings → Plugins → Install Plugin** and enter `@qadanm/paperclip-router`.

## 3. Create a pool

1. Open **Connectors** and choose **Smart Router pool → Add connection pool**.
2. Select connected accounts. Each account becomes one member; choose the model for that member.
3. Order the members. Ties rotate in this order.
4. Set the pool mode to `usage_aware` so Paperclip attaches usage observations. Without it the router still works, from task tier and fairness only.
5. Enable the pool.

## 4. Point an agent at it

Open the agent, set **AI connection** to the pool, and save. New tasks allocate against the pool; existing tasks keep their pinned member.

## 5. Watch the first decisions

Open **Smart Router** in the company navigation. Every allocation appears there with its reasons. If you want a comparison first, turn on **Dry run** in the plugin settings; decisions are recorded but Paperclip's reference rotation is used.

## API equivalents

```bash
# list pools
curl "$HOST/api/companies/$COMPANY/ai-connection-pools" -H "Authorization: Bearer $TOKEN"

# inspection (usage observations per member)
curl "$HOST/api/companies/$COMPANY/ai-connection-pools/$POOL/inspection" -H "Authorization: Bearer $TOKEN"
```
