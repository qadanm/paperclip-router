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
  version: "0.1.0",
  displayName: "Smart Router",
  description:
    "Chooses the right connection-pool account and model for each task: task class, subscription usage windows, and recent provider rejections, with a page that explains every decision.",
  author: "Moe Qadan",
  categories: ["automation"],
  capabilities: [
    "ai.connections.route",
    "issues.read",
    "events.subscribe",
    "plugin.state.read",
    "plugin.state.write",
    "ui.page.register",
  ],
  aiConnectionRouter: {
    name: "Smart Router pool",
    description:
      "Prices each task against the usage windows behind your connected accounts and picks the member that fits.",
  },
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      dryRun: { type: "boolean", default: false, title: "Dry run", description: "Record decisions but keep Paperclip's reference rotation." },
      safetyMarginPercent: { type: "integer", minimum: 50, maximum: 100, default: 85, title: "Safety margin" },
      memoryMinutes: { type: "integer", minimum: 5, maximum: 240, default: 30, title: "Hold a rejecting member back for (minutes)" },
      expiryWeight: { type: "number", minimum: 0, maximum: 3, default: 1, title: "Weight for expiring allowance" },
      floorByTier: {
        type: "object",
        title: "Model tier floor per task tier",
        properties: {
          "1": { type: "integer", minimum: 1, maximum: 3, default: 1 },
          "2": { type: "integer", minimum: 1, maximum: 3, default: 2 },
          "3": { type: "integer", minimum: 1, maximum: 3, default: 3 },
        },
      },
      modelTier: { type: "object", title: "Model tier overrides", additionalProperties: { type: "integer", minimum: 1, maximum: 3 } },
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
    ],
  },
}

export default manifest
