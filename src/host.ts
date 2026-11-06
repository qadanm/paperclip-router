import type { PluginContext } from "@paperclipai/plugin-sdk"
import { classifyTask, type TaskClass } from "./core/classify.js"
import { decideRoute, type RouteRequest, type RouteResult } from "./core/decide.js"
import { classifyRunError } from "./core/failures.js"
import type { Candidate, RankingPolicy } from "./core/score.js"
import {
  DECISION_CAP,
  activeFailures,
  decisionsKey,
  failuresKey,
  pushDecision,
  type DecisionRecord,
  type FailureRecord,
} from "./core/store.js"
import type { MemberUsage, WindowUsage } from "./core/windows.js"

/** Seeded tiers for common models. Anything unknown is tier 2. Config overrides. */
export const SEEDED_MODEL_TIERS: Readonly<Record<string, 1 | 2 | 3>> = {
  "claude-haiku-5": 1,
  "claude-haiku-5-5": 1,
  "gpt-6-mini": 1,
  "gpt-5-mini": 1,
  "deepseek-v4.1-flash": 1,
  "glm-5.3-flash": 1,
  "gemini-3-flash": 1,
  "claude-sonnet-5": 2,
  "claude-sonnet-5-5": 2,
  "gpt-5": 2,
  "gpt-6": 2,
  "glm-5.3": 2,
  "deepseek-v4.1": 2,
  "gemini-3-pro": 2,
  "claude-opus-5": 3,
  "gpt-6-sol": 3,
}

export interface RouterConfig {
  readonly dryRun: boolean
  readonly safetyMarginPercent: number
  readonly memoryMinutes: number
  readonly expiryWeight: number
  readonly floorByTier: Readonly<Record<1 | 2 | 3, number>>
  readonly modelTier: Readonly<Record<string, 1 | 2 | 3>>
}

export const defaultConfig = (): RouterConfig => ({
  dryRun: false,
  safetyMarginPercent: 85,
  memoryMinutes: 30,
  expiryWeight: 1,
  floorByTier: { 1: 1, 2: 2, 3: 3 },
  modelTier: SEEDED_MODEL_TIERS,
})

const normalizeTier = (value: unknown, fallback: 1 | 2 | 3): 1 | 2 | 3 =>
  value === 1 || value === 2 || value === 3 ? value : fallback

export const configFrom = (raw: Record<string, unknown> | null | undefined): RouterConfig => {
  const base = defaultConfig()
  if (!raw) return base
  const floors = (raw.floorByTier ?? {}) as Record<string, unknown>
  const tiers = (raw.modelTier ?? {}) as Record<string, unknown>
  return {
    dryRun: raw.dryRun === true,
    safetyMarginPercent:
      typeof raw.safetyMarginPercent === "number" ? Math.max(50, Math.min(100, raw.safetyMarginPercent)) : base.safetyMarginPercent,
    memoryMinutes:
      typeof raw.memoryMinutes === "number" ? Math.max(5, Math.min(240, raw.memoryMinutes)) : base.memoryMinutes,
    expiryWeight: typeof raw.expiryWeight === "number" ? Math.max(0, Math.min(3, raw.expiryWeight)) : base.expiryWeight,
    floorByTier: {
      1: normalizeTier(floors["1"], 1),
      2: normalizeTier(floors["2"], 2),
      3: normalizeTier(floors["3"], 3),
    },
    modelTier: { ...SEEDED_MODEL_TIERS, ...(tiers as Record<string, 1 | 2 | 3>) },
  }
}

/** Paperclip's usage payload, reduced. Structural so a host shape change is visible here only. */
export const usageFrom = (raw: unknown): MemberUsage | undefined => {
  if (!raw || typeof raw !== "object") return undefined
  const value = raw as Record<string, unknown>
  const status = value.status
  if (status !== "ok" && status !== "unsupported" && status !== "unavailable" && status !== "error") return undefined
  const limits = Array.isArray(value.limits) ? value.limits : []
  const mapped: WindowUsage[] = []
  for (const entry of limits) {
    if (!entry || typeof entry !== "object") continue
    const w = entry as Record<string, unknown>
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
    mapped.push({
      id: typeof w.id === "string" ? w.id : "window",
      label: typeof w.label === "string" ? w.label : "Window",
      scope: typeof w.scope === "string" ? w.scope : null,
      windowSeconds: num(w.windowDurationSeconds),
      resetsAt: typeof w.resetsAt === "string" ? w.resetsAt : null,
      usedPercent: num(w.usedPercent),
      remainingPercent: num(w.remainingPercent),
      limitReached: typeof w.limitReached === "boolean" ? w.limitReached : null,
    })
  }
  return {
    status,
    checkedAt: typeof value.checkedAt === "string" ? value.checkedAt : new Date(0).toISOString(),
    limits: mapped,
  }
}

const companyScope = (companyId: string, stateKey: string) => ({ scopeKind: "company" as const, scopeId: companyId, stateKey })

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T | undefined> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), ms)
      }),
    ])
  } catch {
    return undefined
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Host-facing glue. Keeps the route hook inside its budget by caching and by
 * never awaiting a state write: decisions are queued and flushed on a microtask
 * after the hook has answered the host.
 */
export class RouterHost {
  private readonly ctx: PluginContext
  private readonly decisions = new Map<string, DecisionRecord[]>()
  private readonly failures = new Map<string, FailureRecord[]>()
  private readonly configs = new Map<string, RouterConfig>()
  private readonly tasks = new Map<string, { task: TaskClass; at: number }>()
  private readonly pending = new Map<string, DecisionRecord[]>()
  private loaded = new Set<string>()

  constructor(ctx: PluginContext) {
    this.ctx = ctx
  }

  async config(companyId: string): Promise<RouterConfig> {
    const cached = this.configs.get(companyId)
    if (cached) return cached
    const raw = await withTimeout(this.ctx.config.get(companyId), 800)
    const config = configFrom(raw as Record<string, unknown> | undefined)
    this.configs.set(companyId, config)
    return config
  }

  async ensureLoaded(companyId: string): Promise<void> {
    if (this.loaded.has(companyId)) return
    this.loaded.add(companyId)
    try {
      const decisions = await withTimeout(this.ctx.state.get(companyScope(companyId, decisionsKey(companyId))), 800)
      if (Array.isArray(decisions)) this.decisions.set(companyId, decisions as DecisionRecord[])
      const failures = await withTimeout(this.ctx.state.get(companyScope(companyId, failuresKey(companyId))), 800)
      if (Array.isArray(failures)) this.failures.set(companyId, failures as FailureRecord[])
    } catch {
      // State is advisory; a cold worker must still route.
    }
  }

  async taskFor(companyId: string, taskKey: string): Promise<TaskClass> {
    const cached = this.tasks.get(taskKey)
    if (cached && Date.now() - cached.at < 60_000) return cached.task
    const issue = await withTimeout(this.ctx.issues.get(taskKey, companyId), 1200)
    const task = issue
      ? classifyTask({ title: issue.title, description: issue.description ?? undefined })
      : classifyTask({ title: "" })
    this.tasks.set(taskKey, { task, at: Date.now() })
    return task
  }

  policy(config: RouterConfig): RankingPolicy {
    return {
      floorByTier: config.floorByTier,
      modelTier: config.modelTier,
      expiryWeight: config.expiryWeight,
    }
  }

  async decide(input: {
    companyId: string
    agentId: string
    taskKey: string
    request: RouteRequest
  }): Promise<RouteResult> {
    await this.ensureLoaded(input.companyId)
    const config = await this.config(input.companyId)
    const task = await this.taskFor(input.companyId, input.taskKey)
    const memory = activeFailures(this.failures.get(input.companyId) ?? [], new Date(), config.memoryMinutes)
    const result = decideRoute({ request: input.request, task, memory, policy: this.policy(config), now: new Date() })

    const record: DecisionRecord = {
      at: new Date().toISOString(),
      companyId: input.companyId,
      taskKey: input.taskKey,
      agentId: input.agentId,
      chosen: result.kind === "selected" ? result.memberId : null,
      skipped: result.skipped,
      signals: task.signals,
      mode: config.dryRun ? "dry-run" : "routed",
    }
    this.queueDecision(input.companyId, record)

    return config.dryRun ? this.referenceRotation(input.request, result) : result
  }

  /**
   * What the host would do without this plugin: rotate from the last member and
   * skip only observed-blocked candidates. Dry run records our choice but
   * returns this, so a week of shadowing is a fair comparison.
   */
  private referenceRotation(request: RouteRequest, ours: RouteResult): RouteResult {
    const present = request.candidates.map((candidate) => candidate.memberId)
    const ordered = request.memberOrder.filter((id) => present.includes(id))
    for (const id of present) if (!ordered.includes(id)) ordered.push(id)
    const start = request.lastMemberId ? ordered.indexOf(request.lastMemberId) : -1
    const rotated = start >= 0 ? [...ordered.slice(start + 1), ...ordered.slice(0, start + 1)] : ordered
    const usable = rotated.find((id) => {
      const candidate = request.candidates.find((entry) => entry.memberId === id)
      return candidate && !(candidate.usage?.status === "ok" && candidate.usage.limits.some((w) => w.limitReached === true))
    })
    if (usable) return { kind: "selected", memberId: usable, skipped: ours.skipped }
    return ours
  }

  private queueDecision(companyId: string, record: DecisionRecord): void {
    const ring = pushDecision([...(this.pending.get(companyId) ?? []), ...(this.decisions.get(companyId) ?? [])], record, DECISION_CAP)
    this.decisions.set(companyId, ring.slice(0, DECISION_CAP))
    const queue = [...(this.pending.get(companyId) ?? []), record]
    this.pending.set(companyId, queue)
    // Never awaited by the route hook: a state write must not eat the budget.
    queueMicrotask(() => void this.flushDecisions(companyId))
  }

  private async flushDecisions(companyId: string): Promise<void> {
    const queue = this.pending.get(companyId)
    if (!queue || queue.length === 0) return
    this.pending.delete(companyId)
    try {
      await this.ctx.state.set(companyScope(companyId, decisionsKey(companyId)), this.decisions.get(companyId) ?? [])
    } catch {
      // Losing a decision row is acceptable; blocking a run is not.
    }
  }

  async recordRunFailure(companyId: string, agentId: string, issueId: string | undefined, error: string | undefined, errorCode: string | undefined): Promise<void> {
    const classification = classifyRunError({ error, errorCode })
    if (classification !== "deterministic") return
    await this.ensureLoaded(companyId)
    const recent = (this.decisions.get(companyId) ?? []).find(
      (entry) => entry.agentId === agentId && entry.chosen !== null && (issueId === undefined || entry.taskKey === issueId),
    )
    if (!recent?.chosen) return
    const failures = [
      { memberId: recent.chosen, at: new Date().toISOString(), taskKey: recent.taskKey, class: classification },
      ...(this.failures.get(companyId) ?? []),
    ].slice(0, 100)
    this.failures.set(companyId, failures)
    try {
      await this.ctx.state.set(companyScope(companyId, failuresKey(companyId)), failures)
    } catch {
      // Advisory.
    }
  }

  data(companyId: string): { decisions: DecisionRecord[]; members: Array<{ memberId: string; chosen: boolean }> } {
    const decisions = (this.decisions.get(companyId) ?? []).slice(0, 50)
    const members = [...new Set(decisions.map((entry) => entry.chosen).filter((id): id is string => id !== null))].map((memberId) => ({
      memberId,
      chosen: true,
    }))
    return { decisions, members }
  }
}
