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
  readonly signals: string[]
}

export interface ClassifierInput {
  readonly title: string
  readonly description?: string | undefined
  readonly labels?: readonly string[] | undefined
}

const architectureTerms =
  /\b(architecture|architectural|multi-tenant|multi tenant|distributed|microservice|event sourcing|event-driven|schema design|data model|migration|monorepo|scalab|concurrency|race condition|deadlock|cross-service|cross service|refactor across)\b/i
const securityTerms = /\b(security review|threat model|authorization model|oauth|encryption|vulnerability|exploit|injection|xss|csrf|privilege escalation)\b/i
const designTerms = /\b(redesign|design system|visual design|ux audit|figma|mockup|wireframe|typography|landing page|component library|accessibility audit)\b/i
const debugTerms = /\b(crash|bug|broken|fails?|failure|regression|not working|error|exception|flaky)\b/i
const testTerms = /\b(tests?|spec|coverage|vitest|jest|playwright|pytest)\b/i
const docsTerms = /\b(readme|documentation|docs|jsdoc|docstring|changelog)\b/i

const mechanicalPatterns: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
  { name: "rename", pattern: /\brename\s+(?:the\s+)?[A-Za-z_$][\w$.-]*\s+to\s+[A-Za-z_$][\w$.-]*\b/i },
  { name: "rename-copy", pattern: /\brename\s+(?:the\s+)?[^.!?\n]{0,60}\b(label|title|heading|text|button|copy|tab|menu)\b/i },
  { name: "typo", pattern: /\b(fix|correct)\s+(?:a\s+)?(?:typo|spelling|misspell(?:ing)?)\b/i },
  { name: "format", pattern: /\b(format|prettier|lint|eslint|gofmt|rustfmt)\b/i },
  { name: "imports", pattern: /\b(sort|organize|remove unused)\s+imports?\b/i },
  { name: "version", pattern: /\b(bump|update|change)\s+(?:the\s+)?(?:package\s+)?version\b/i },
  { name: "label", pattern: /\b(change|update)\s+(?:the\s+)?(?:button\s+)?label\b/i },
]

const broadScopeTerms = /\b(all|every|everywhere|across|multiple|codebase|project|architecture|refactor|implement|migrate|migration|responsive|theme|states?|tests?|debug|investigate|security|performance|service|repo)\b/i
const simpleWord = /\b(simple|small|quick|trivial|easy|just)\b/i

const hasStackTrace = (text: string) =>
  /\n\s+at\s+\S+/.test(text) || /traceback \(most recent call last\)/i.test(text) || /\buncaught\b|\bpanic:|\bexception\b/i.test(text)

/**
 * Deterministic local classification for a Paperclip task. Structure decides,
 * never a self-description: a "simple refactor everywhere" is still a broad
 * change. Ambiguity resolves to tier 2.
 */
export const classifyTask = (input: ClassifierInput): TaskClass => {
  const text = `${input.title ?? ""}\n${input.description ?? ""}`.trim()
  const labels = (input.labels ?? []).join(" ")
  const scoring = `${text}\n${labels}`
  if (scoring.trim().length === 0) return { kind: "unknown", tier: 2, signals: [] }

  const signals: string[] = []
  const stackTrace = hasStackTrace(text)
  if (stackTrace) signals.push("stack_trace")
  if (simpleWord.test(scoring)) signals.push("self_described_simple_ignored")

  const mechanicalMatches = mechanicalPatterns.filter((pattern) => pattern.pattern.test(scoring))
  if (mechanicalMatches.length > 0) signals.push(`mechanical:${mechanicalMatches.map((match) => match.name).join(",")}`)
  const narrowScope = text.length < 550 && !broadScopeTerms.test(scoring) && mechanicalMatches.length > 0
  if (narrowScope) signals.push("narrow_scope")

  const architecture = architectureTerms.test(scoring)
  const security = securityTerms.test(scoring)
  const design = designTerms.test(scoring)
  const debug = debugTerms.test(scoring) || stackTrace
  const broad = broadScopeTerms.test(scoring)
  if (architecture) signals.push("architecture")
  if (security) signals.push("security")
  if (design) signals.push("design")
  if (broad) signals.push("broad_scope")

  const kind: TaskClass["kind"] = architecture
    ? "architecture"
    : security
      ? "security"
      : design
        ? "design"
        : narrowScope || (mechanicalMatches.length > 0 && !broad)
          ? "mechanical"
          : debug
            ? "debug"
            : /\brefactor\b/i.test(scoring)
              ? "refactor"
              : testTerms.test(scoring)
                ? "test"
                : docsTerms.test(scoring)
                  ? "docs"
                  : /\b(add|implement|build|create|support|introduce|feature)\b/i.test(scoring)
                    ? "feature"
                    : "unknown"

  const tier: TaskClass["tier"] =
    architecture || security || (debug && stackTrace && broad) || (design && broad)
      ? 3
      : narrowScope || kind === "mechanical"
        ? 1
        : 2

  return { kind, tier, signals }
}
