import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk"

/**
 * Paperclip loads this manifest at install time, advertises the plugin in the
 * Connectors catalog as a connection router, and mounts the decisions page at
 * /:companyPrefix/router.
 *
 * The capability list is deliberately exact: the host enforces each one at
 * runtime, and every entry here is used by the worker or the page. Keeping the
 * list minimal keeps the install prompt honest.
 */
const manifest: PaperclipPluginManifestV1 = {
  id: "qadan.paperclip-router",
  apiVersion: 1,
  version: "0.3.0",
  displayName: "Smart Router",
  description:
    "Routes each task to the pool account and model that fits it, and explains the choice: task class with confidence, usage windows where the host reports them, and members held back after a rejection.",
  author: "Moe Qadan",
  categories: ["automation"],
  capabilities: [
    "ai.connections.route",
    "issues.read",
    "events.subscribe",
    "plugin.state.read",
    "plugin.state.write",
    "ui.page.register",
    "ui.sidebar.register",
  ],
  aiConnectionRouter: {
    name: "Smart Router pool",
    description:
      "Picks the pool member that fits each task and records why. Members, tiers, usage and held-back accounts are visible on its page.",
  },
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      dryRun: {
        type: "boolean",
        default: false,
        title: "Dry run",
        description: "Record every decision, but keep Paperclip's own rotation. Use it for a week to compare.",
      },
      safetyMarginPercent: {
        type: "integer",
        minimum: 50,
        maximum: 100,
        default: 85,
        title: "Safety margin",
        description: "Skip a member whose weakest window is past this, when another member has room.",
      },
      memoryMinutes: {
        type: "integer",
        minimum: 5,
        maximum: 240,
        default: 30,
        title: "Hold a rejecting member back for (minutes)",
        description: "How long a deterministic rejection keeps a member out of new tasks.",
      },
      expiryWeight: {
        type: "number",
        minimum: 0,
        maximum: 3,
        default: 1,
        title: "Weight for expiring allowance",
        description: "How strongly allowance that resets soon discounts a member.",
      },
      floorByTier: {
        type: "object",
        title: "Model tier floor per task tier",
        description: "The model tier each task tier requires. A floor is a preference: when no member meets it, the nearest is used and the deviation is recorded.",
        properties: {
          "1": { type: "integer", minimum: 1, maximum: 3, default: 1 },
          "2": { type: "integer", minimum: 1, maximum: 3, default: 2 },
          "3": { type: "integer", minimum: 1, maximum: 3, default: 3 },
        },
      },
      modelTier: {
        type: "object",
        title: "Model tier overrides",
        description: "Add a tier for a model the plugin does not know. Unknown models are treated as tier 2.",
        additionalProperties: { type: "integer", minimum: 1, maximum: 3 },
      },
    },
  },
  ui: {
    slots: [
      {
        type: "page",
        id: "router-decisions",
        displayName: "Smart Router",
        exportName: "RouterDecisionsPage",
        routePath: "router",
      },
      {
        // A page has a URL but no navigation entry on its own. This slot is the
        // sidebar link, so the page is reachable from where a person works.
        type: "sidebar",
        id: "router-sidebar-entry",
        displayName: "Smart Router",
        exportName: "RouterSidebarEntry",
        order: 60,
      },
    ],
  },
}

export default manifest
