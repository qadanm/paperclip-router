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
    "Chooses the right connection-pool account and model for each task: task class, subscription usage windows, continuity, and recent provider rejections, with a page that explains every decision.",
  author: "Moe Qadan",
  categories: ["automation"],
  capabilities: [
    "ai.connections.route",
    "issues.read",
    "events.subscribe",
    "plugin.state.read",
    "plugin.state.write",
    "ui.page.register",
    "agents.read",
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
