import { useState } from "react"
import type { DecisionRecord } from "../core/store.js"
import type { MemberState } from "../core/members.js"
import { BrandMark, pageCss } from "./theme.js"

export interface DecisionsPayload {
  readonly decisions: ReadonlyArray<DecisionRecord>
  readonly members: ReadonlyArray<MemberState>
  readonly memoryMinutes?: number | undefined
  readonly repaired?: number | undefined
}

/**
 * The page.
 *
 * The question this has to answer, in order: is my pool healthy, and why did it
 * pick that account for that task. Everything below serves that sequence. Pool
 * standing first, because a held-back member is the only actionable thing here.
 * Decisions second, one dense row each, expanding in place for the reasoning.
 *
 * Rows are led by the task, not the model. "Add billing webhooks" is what a
 * person recognises; `claude-sonnet-5-5 · codex` is the answer, and it belongs
 * underneath. Older records without a stored title fall back to the short task
 * reference rather than pretending to know.
 */

const PAGE_SIZE = 8

/** Signals arrive as identifiers. People read phrases. */
const SIGNAL_COPY: Readonly<Record<string, string>> = {
  broad_scope: "broad scope",
  long_brief: "long brief",
  stack_trace: "stack trace",
  self_described_simple_ignored: "said it was simple",
  simple_discount: "short request",
  narrow_scope: "narrow scope",
}

const signalText = (signal: string) => SIGNAL_COPY[signal] ?? signal.replace(/_/g, " ")

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

/** Relative time first: "4 min ago" answers more than a wall clock does. */
const ago = (iso: string | undefined): string => {
  if (!iso) return ""
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return ""
  const seconds = (Date.now() - at) / 1000
  if (seconds < 45) return "just now"
  if (seconds < 90) return "1 min ago"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? "hr" : "hrs"} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`
  return new Date(at).toLocaleDateString([], { month: "short", day: "numeric" })
}

/** The exact value, for the title attribute. Relative time must never hide it. */
const exact = (iso: string | undefined): string | undefined => {
  if (!iso) return undefined
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return undefined
  return new Date(at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
}

/** Host keys read `lifecycle:<uuid>`. Eight characters find the task again. */
const shortRef = (taskKey: string): string => {
  if (!taskKey) return "no task key"
  const uuid = taskKey.includes(":") ? taskKey.slice(taskKey.indexOf(":") + 1) : taskKey
  return uuid.slice(0, 8)
}

function Chevron() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M3.4 2 6.8 5l-3.4 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Tier as an ordinal: three segments, filled as far as the task requires. */
function Tier({ tier, confidence }: { tier: 1 | 2 | 3; confidence: number }) {
  const firm = confidence >= 0.7
  return (
    <span className="sr-tier">
      <span className="sr-meter" aria-hidden="true">
        {[1, 2, 3].map((step) => (
          <i key={step} className={step <= tier ? "on" : undefined} />
        ))}
      </span>
      <span className="sr-tier-text">
        <span className="sr-sr-only">{`model tier ${tier} of 3, `}</span>
        {`tier ${tier}`}
        {firm ? "" : " · borderline"}
      </span>
    </span>
  )
}

function Lockup({ title }: { title?: string | undefined }) {
  return (
    <div className="sr-brand">
      <BrandMark height={30} title={title} />
      <div className="sr-lockup">
        <span className="sr-wordmark">Smart Router</span>
        <span className="sr-attribute">For Paperclip</span>
      </div>
    </div>
  )
}

function Pool({ members, decisions }: { members: ReadonlyArray<MemberState>; decisions: ReadonlyArray<DecisionRecord> }) {
  const held = members.filter((member) => member.benched)
  const total = decisions.filter((decision) => decision.chosen).length

  return (
    <section className="sr-section" aria-labelledby="sr-pool-label">
      <div className="sr-head">
        <h2 className="sr-label" id="sr-pool-label">
          Pool
        </h2>
        <span className="sr-count">
          {held.length === 0
            ? `${plural(members.length, "member")}, all eligible`
            : `${plural(held.length, "member")} held back`}
        </span>
      </div>
      <div className="sr-table sr-members">
        <div className="sr-tr sr-tr-head" aria-hidden="true">
          <span>Account</span>
          <span>Standing</span>
          <span>Chosen</span>
          <span>Last used</span>
        </div>
        {members.map((member) => {
          const share = total > 0 && member.chosenCount > 0 ? Math.round((member.chosenCount / total) * 100) : null
          return (
            <div className="sr-tr" key={member.memberId}>
              <div style={{ minWidth: 0 }}>
                <div className="sr-member-name" title={member.memberId}>
                  {member.label}
                </div>
                <div className="sr-sub">
                  {member.benched && member.benchedUntil
                    ? `free again ${ago(member.benchedUntil)}`
                    : share !== null
                      ? `${share}% of decisions`
                      : "no decisions yet"}
                </div>
              </div>
              <div>
                <span className={`sr-standing ${member.benched ? "sr-stand-held" : "sr-stand-ok"}`}>
                  <span className="sr-dot" aria-hidden="true" />
                  {member.benched ? "held back" : "ready"}
                </span>
              </div>
              <div className="sr-num" style={{ fontSize: 12.5 }}>
                {member.chosenCount === 0 ? <span className="sr-muted">none</span> : member.chosenCount}
              </div>
              <div className="sr-when" style={{ textAlign: "left" }} title={exact(member.lastChosenAt)}>
                {member.lastChosenAt ? ago(member.lastChosenAt) : <span className="sr-muted">not yet</span>}
              </div>
            </div>
          )
        })}
      </div>
      {held.length > 0 ? (
        <p className="sr-sub" style={{ margin: "7px 0 0", maxWidth: "74ch" }}>
          A held-back member rejected a request in a way a retry will not fix. It rejoins new tasks when its window ends.
          Nothing to do.
        </p>
      ) : null}
    </section>
  )
}

function DecisionRow({ decision, index }: { decision: DecisionRecord; index: number }) {
  const skips = Object.entries(decision.skipped)
  const id = `sr-d${index}`
  const task = decision.taskTitle
  const chosen = decision.chosenLabel ?? decision.chosen

  return (
    <details className="sr-row">
      <summary className="sr-tr sr-summary" aria-controls={id}>
        <span className="sr-chev">
          <Chevron />
        </span>
        <span className="sr-chosen">
          <span className={`sr-chosen-task${task ? "" : " is-none"}`} title={task ?? decision.taskKey}>
            {task ?? shortRef(decision.taskKey)}
          </span>
          <span className="sr-chosen-meta">
            {chosen ? <span>{chosen}</span> : <span>no eligible member</span>}
            {task ? (
              <>
                <span className="sr-sep" aria-hidden="true">
                  ·
                </span>
                <span className="sr-ref">{shortRef(decision.taskKey)}</span>
              </>
            ) : null}
            {decision.mode === "dry-run" ? (
              <>
                <span className="sr-sep" aria-hidden="true">
                  ·
                </span>
                <span>dry run</span>
              </>
            ) : null}
          </span>
        </span>
        <Tier tier={decision.tier} confidence={decision.confidence} />
        <span className="sr-when" title={exact(decision.at)}>
          {ago(decision.at)}
        </span>
      </summary>
      <div className="sr-detail" id={id}>
        <div className="sr-detail-inner">
          {decision.note ? <p className="sr-note">{decision.note}</p> : null}

          {skips.length > 0 ? (
            <div>
              <div className="sr-detail-label">Passed over</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {skips.map(([memberId, reason]) => (
                  <div className="sr-skip" key={memberId}>
                    <span className="sr-skip-name" title={memberId}>
                      {decision.labels?.[memberId] ?? memberId}
                    </span>
                    <span className="sr-skip-why">{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {decision.signals.length > 0 ? (
            <div>
              <div className="sr-detail-label">Read as</div>
              <div className="sr-signals">
                {decision.signals.map((signal) => (
                  <span className="sr-signal" key={signal}>
                    {signalText(signal)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="sr-num" style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>
            {`tier ${decision.tier} of 3 · confidence ${Math.round(decision.confidence * 100)}%`}
            {decision.mode === "dry-run" ? " · recorded during dry run" : ""}
          </div>
        </div>
      </div>
    </details>
  )
}

function EmptyState() {
  return (
    <div className="sr-empty">
      <div className="sr-empty-title">No decisions yet</div>
      <div className="sr-empty-body">
        The router records a decision every time an agent asks for a connection. Nothing has asked yet, so there is nothing
        to explain.
      </div>
      <ol className="sr-empty-steps">
        <li>
          <span className="sr-step-n">1</span>
          <span>Put at least two accounts in one pool, so there is a choice to make.</span>
        </li>
        <li>
          <span className="sr-step-n">2</span>
          <span>Point an agent's AI connection at that pool.</span>
        </li>
        <li>
          <span className="sr-step-n">3</span>
          <span>Give the agent a task. The decision lands here with its reasoning.</span>
        </li>
      </ol>
    </div>
  )
}

export function DecisionsView({ data }: { data: DecisionsPayload | undefined }) {
  const [expanded, setExpanded] = useState(false)
  const decisions = data?.decisions ?? []
  const members = data?.members ?? []
  const shown = expanded ? decisions : decisions.slice(0, PAGE_SIZE)
  const held = members.filter((member) => member.benched).length
  const dryRun = decisions.length > 0 && decisions.every((decision) => decision.mode === "dry-run")

  return (
    <div className="sr-page">
      <style>{pageCss}</style>
      <div className="sr-inner">
        <header className="sr-masthead">
          <Lockup title="Smart Router" />
          <div className="sr-live">
            {decisions.length === 0 ? (
              <span className="sr-chip sr-chip-quiet">waiting for first task</span>
            ) : dryRun ? (
              <span className="sr-chip">
                <span className="sr-chip-dot" aria-hidden="true" />
                dry run
              </span>
            ) : (
              <span className="sr-chip">
                <span className="sr-chip-dot" aria-hidden="true" />
                routing
              </span>
            )}
            {held > 0 ? <span className="sr-chip sr-chip-quiet">{plural(held, "held back")}</span> : null}
          </div>
        </header>

        <Pool members={members} decisions={decisions} />

        <section className="sr-section" aria-labelledby="sr-decisions-label">
          <div className="sr-head">
            <h2 className="sr-label" id="sr-decisions-label">
              Decisions
            </h2>
            <span className="sr-count">
              {decisions.length === 0 ? "newest first" : `${decisions.length}, newest first`}
            </span>
          </div>

          {decisions.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="sr-table sr-decisions">
                <div className="sr-tr sr-tr-head" aria-hidden="true">
                  <span />
                  <span>Task</span>
                  <span>Tier</span>
                  <span style={{ textAlign: "right" }}>When</span>
                </div>
                {shown.map((decision, index) => (
                  <DecisionRow key={`${decision.at}-${decision.taskKey}-${index}`} decision={decision} index={index} />
                ))}
              </div>
              {decisions.length > PAGE_SIZE ? (
                <button type="button" className="sr-more" onClick={() => setExpanded((value) => !value)}>
                  {expanded ? "Show the newest 8" : `Show all ${decisions.length}`}
                </button>
              ) : null}
            </>
          )}
        </section>

        <footer className="sr-foot">
          Each decision weighs the task's shape against model tier, the allowance windows your providers report, and recent
          rejections.{data?.memoryMinutes ? ` A rejection keeps a member out for ${data.memoryMinutes} minutes.` : ""}
          {data?.repaired ? ` ${plural(data.repaired, "older record was", "older records were")} read from a previous format.` : ""}
          {" "}Pinned tasks are never rerouted.
        </footer>
      </div>
    </div>
  )
}

export function DecisionsLoading() {
  return (
    <div className="sr-page" aria-busy="true" aria-live="polite">
      <style>{pageCss}</style>
      <div className="sr-inner">
        <header className="sr-masthead">
          <Lockup />
        </header>
        <div className="sr-section">
          <div className="sr-head">
            <span className="sr-label">Pool</span>
          </div>
          <div className="sr-skeleton">
            <div className="sr-skeleton-row" />
            <div className="sr-skeleton-row" />
          </div>
        </div>
        <span className="sr-sr-only">Loading router state</span>
      </div>
    </div>
  )
}

export function DecisionsError({ message }: { message: string }) {
  return (
    <div className="sr-page">
      <style>{pageCss}</style>
      <div className="sr-inner">
        <header className="sr-masthead">
          <Lockup />
        </header>
        <div className="sr-empty" style={{ marginTop: 20 }}>
          <div className="sr-empty-title">Could not read router state</div>
          <div className="sr-empty-body">
            The plugin worker did not answer. Routing is unaffected: when a decision cannot be made, the host falls back to
            its own rotation.
          </div>
          <div className="sr-ref" style={{ marginTop: 10, color: "var(--muted-foreground)" }}>
            {message}
          </div>
        </div>
      </div>
    </div>
  )
}
