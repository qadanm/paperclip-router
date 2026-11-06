import esbuild from "esbuild"
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers"

/**
 * Paperclip's loader imports a bundled worker, a bundled manifest, and a single
 * bundled UI entry. The SDK presets carry the externalization contract (React
 * and the SDK stay host-provided), so we use them instead of hand-rolled flags.
 */
const presets = createPluginBundlerPresets({ uiEntry: "src/ui/index.tsx" })

/**
 * The SDK's own presets externalize React for the worker but not the SDK package
 * itself, so a plain build inlines @paperclipai/plugin-sdk and its `effect`
 * dependency: a 1.8 MB worker carrying a second copy of a runtime the host
 * already has loaded. The host provides the SDK at import time, so it belongs in
 * `external` alongside React. Same reasoning as the UI preset.
 */
presets.esbuild.worker.external = [...(presets.esbuild.worker.external ?? []), "@paperclipai/plugin-sdk"]
presets.esbuild.manifest.external = ["@paperclipai/plugin-sdk"]
const watch = process.argv.includes("--watch")

const workerCtx = await esbuild.context(presets.esbuild.worker)
const manifestCtx = await esbuild.context(presets.esbuild.manifest)
const uiCtx = await esbuild.context(presets.esbuild.ui)

if (watch) {
  await Promise.all([workerCtx.watch(), manifestCtx.watch(), uiCtx.watch()])
  console.log("esbuild watch mode enabled")
} else {
  await Promise.all([workerCtx.rebuild(), manifestCtx.rebuild(), uiCtx.rebuild()])
  await Promise.all([workerCtx.dispose(), manifestCtx.dispose(), uiCtx.dispose()])
}
