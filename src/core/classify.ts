export type TaskKind =
  | "mechanical"
  | "docs"
  | "test"
  | "feature"
  | "debug"
  | "refactor"
  | "security"
  | "architecture"
  | "design"
  | "unknown"

export interface TaskClass {
  readonly kind: TaskKind
  readonly tier: 1 | 2 | 3
  /** 0..1. How far the score sits from the nearest tier boundary. */
  readonly confidence: number
  readonly signals: string[]
}

export interface ClassifierInput {
  readonly title: string
  readonly description?: string | undefined
  readonly labels?: readonly string[] | undefined
}

/**
 * Dimension scoring, after ClawRouter's MIT router core.
 *
 * A keyword ladder gives one answer and no way to say "this is close". ClawRouter
 * scores many small dimensions, weights them, then derives confidence from the
 * distance to the nearest tier boundary. That is the part worth copying, because
 * a router that admits uncertainty can be conservative near the edge and
 * confident away from it.
 *
 * Where we differ, and why:
 * - Their `simple` dimension subtracts a flat penalty at any occurrence, so one
 *   "simple" inside a long architecture brief can outvote the brief. We require
 *   a short prompt before the discount applies, and cap it.
 * - Paperclip issues carry a title plus a description that often holds a
 *   requirements list, so constraints and imperatives carry more weight here and
 *   raw length carries less.
 * - They may return no tier at all. A pool must always get a member, so this
 *   returns a tier always, with the confidence telling the caller how firm it is.
 */

interface Dimension {
  readonly name: keyof Weights
  readonly score: number
  /** Reported when the dimension fired, for the decision page. */
  readonly signal?: string
}

interface Weights {
  readonly scope: number
  readonly architecture: number
  readonly security: number
  readonly debug: number
  readonly design: number
  readonly constraints: number
  readonly imperatives: number
  readonly bundle: number
  readonly simplicity: number
}

const WEIGHTS: Weights = {
  scope: 0.16,
  architecture: 0.72,
  security: 0.68,
  debug: 0.34,
  design: 0.3,
  constraints: 0.16,
  imperatives: 0.12,
  bundle: 0.26,
  simplicity: 0.16,
}

/**
 * Tier boundaries. Tier 1 ends at 0.2, tier 3 starts at 0.5. A single strong
 * signal (architecture, security) crosses 0.5 on its own, because those classes
 * are the ones where the wrong model is expensive; a mechanical pattern with no
 * scope words lands under 0.2 on its own.
 */
const SIMPLE_MAX = 0.2
const COMPLEX_MIN = 0.5

const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length
const has = (text: string, pattern: RegExp) => pattern.test(text)

const architectureTerms =
  /\b(architecture|architectural|multi-tenant|multi tenant|distributed|microservice|event sourcing|event-driven|schema design|data model|migration|monorepo|scalab|concurrency|race condition|deadlock|cross-service|cross service|refactor across|tenant isolation)\b/gi
const securityTerms = /\b(security review|threat model|authorization model|oauth|encryption|vulnerability|exploit|injection|xss|csrf|privilege escalation)\b/gi
const designTerms = /\b(redesign|design system|visual design|ux audit|figma|mockup|wireframe|typography|landing page|component library|accessibility audit)\b/gi
const debugTerms = /\b(crash|bug|broken|fails?|failure|regression|not working|error|exception|flaky)\b/gi
const testTerms = /\b(tests?|spec|coverage|vitest|jest|playwright|pytest)\b/gi
const docsTerms = /\b(readme|documentation|docs|jsdoc|docstring|changelog)\b/gi
const constraintTerms = /^\s*(?:[-*]|\d+\.)\s+\S/gm
const imperativeTerms = /\b(add|build|create|implement|introduce|refactor|migrate|replace|remove|split|extract|rename|wire|integrate)\b/gi
const bundleTerms = /\b(across|everywhere|entire|whole|all files|multiple|codebase|repo|repository|services?|modules?|packages?)\b/gi
const simpleTerms = /\b(simple|quick|tiny|trivial|one[- ]liner|typo)\b/gi

const mechanicalPatterns: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
  { name: "rename", pattern: /\brename\s+(?:the\s+)?[A-Za-z_$][\w$.-]*\s+to\s+[A-Za-z_$][\w$.-]*\b/i },
  { name: "rename-copy", pattern: /\brename\s+(?:the\s+)?[^.!?\n]{0,60}\b(label|title|heading|text|button|copy|tab|menu)\b/i },
  { name: "typo", pattern: /\b(fix|correct)\s+(?:a\s+)?(?:typo|spelling|misspell(?:ing)?)\b/i },
  { name: "format", pattern: /\b(format|prettier|lint|eslint|gofmt|rustfmt)\b/i },
  { name: "imports", pattern: /\b(sort|organize|remove unused)\s+imports?\b/i },
  { name: "version", pattern: /\b(bump|update|change)\s+(?:the\s+)?(?:package\s+)?version\b/i },
  { name: "label", pattern: /\b(change|update)\s+(?:the\s+)?(?:button\s+)?label\b/i },
]

const hasStackTrace = (text: string) =>
  /\n\s+at\s+\S+/.test(text) || /traceback \(most recent call last\)/i.test(text) || /\buncaught\b|\bpanic:|\bexception\b/i.test(text)

/** 0..1 from a keyword count: one hit is half strength, two or more is full. */
const keywordScore = (hits: number) => (hits === 0 ? 0 : hits === 1 ? 0.5 : 1)

export const classifyTask = (input: ClassifierInput): TaskClass => {
  const text = `${input.title ?? ""}\n${input.description ?? ""}`.trim()
  const labels = (input.labels ?? []).join(" ")
  const scoring = `${text}\n${labels}`.trim()
  if (scoring.length === 0) return { kind: "unknown", tier: 2, confidence: 0.2, signals: [] }

  const signals: string[] = []

  // Length is evidence of scope, but weakly: a terse issue can still be huge.
  const length = text.length
  const scope = length > 1400 ? 1 : length > 600 ? 0.6 : length > 200 ? 0.3 : 0

  const architecture = Math.min(1, count(scoring, architectureTerms) / 2)
  const security = Math.min(1, count(scoring, securityTerms) / 2)
  const debug = Math.min(1, count(scoring, debugTerms) / 2 + (hasStackTrace(text) ? 0.5 : 0))
  const design = Math.min(1, count(scoring, designTerms) / 2)
  const constraints = Math.min(1, count(text, constraintTerms) / 3)
  const imperatives = Math.min(1, count(scoring, imperativeTerms) / 3)
  const bundle = Math.min(1, count(scoring, bundleTerms) / 2)

  // Simplicity only discounts short prompts: "simple" inside a long brief is
  // usually the author misjudging the work, which is exactly when a discount
  // would be harmful.
  const simpleHits = count(scoring, simpleTerms)
  const broad = bundle >= 0.5 || count(scoring, /(everywhere|all files|entire|whole)/gi) > 0
  const simplicity = simpleHits > 0 && length < 220 && !broad ? Math.min(1, simpleHits / 2) : 0

  const mechanicalMatches = mechanicalPatterns.filter((pattern) => pattern.pattern.test(scoring))
  const narrow = mechanicalMatches.length > 0 && length < 220 && bundle < 0.5 && architecture === 0

  if (hasStackTrace(text)) signals.push("stack_trace")
  if (scope > 0) signals.push("long_brief")
  if (architecture > 0) signals.push("architecture")
  if (security > 0) signals.push("security")
  if (debug > 0) signals.push("debug")
  if (design > 0) signals.push("design")
  if (constraints > 0) signals.push("constraints")
  if (bundle > 0) signals.push("broad_scope")
  if (simpleHits > 0) signals.push(broad ? "self_described_simple_ignored" : "simple_discount")
  if (mechanicalMatches.length > 0) signals.push(`mechanical:${mechanicalMatches.map((match) => match.name).join(",")}`)

  const raw =
    scope * WEIGHTS.scope +
    architecture * WEIGHTS.architecture +
    security * WEIGHTS.security +
    debug * WEIGHTS.debug +
    design * WEIGHTS.design +
    constraints * WEIGHTS.constraints +
    imperatives * WEIGHTS.imperatives +
    bundle * WEIGHTS.bundle -
    simplicity * WEIGHTS.simplicity -
    (narrow ? 0.14 : 0)

  const score = Math.max(0, Math.min(1.4, raw))

  const tier: 1 | 2 | 3 = score < SIMPLE_MAX ? 1 : score < COMPLEX_MIN ? 2 : 3

  // Confidence is distance to the nearest boundary, mapped through a logistic, so
  // a score sitting on a boundary reads as uncertain rather than decisive.
  const distance =
    tier === 1
      ? SIMPLE_MAX - score
      : tier === 3
        ? score - COMPLEX_MIN
        : Math.min(score - SIMPLE_MAX, COMPLEX_MIN - score)
  // The logistic saturates too fast on small distances; scale so a score on a
  // boundary reads near 0.5 rather than 0.9.
  const confidence = Math.max(0.2, Math.min(0.98, 1 / (1 + Math.exp(-6 * distance))))

  const kind: TaskClass["kind"] = architecture > 0
    ? "architecture"
    : security > 0
      ? "security"
      : design > 0 && design >= debug
        ? "design"
        : debug > 0
          ? "debug"
          : narrow
            ? "mechanical"
            : /\brefactor\b/i.test(scoring)
              ? "refactor"
              : testTerms.test(scoring)
                ? "test"
                : docsTerms.test(scoring)
                  ? "docs"
                  : /\b(add|implement|build|create|support|introduce|feature)\b/i.test(scoring)
                    ? "feature"
                    : "unknown"

  return { kind, tier, confidence, signals }
}
