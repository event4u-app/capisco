/**
 * Ticket-lifecycle contract (B6 Phase 1, concept §4.5/§7 north-star).
 *
 * Closes the smallest end-to-end slice of the north-star workflow:
 *
 *   pull ticket  →  worktree + session up   →  status: In Progress
 *   …work…
 *   finished     →  diff + quality + review  →  status: In Review
 *
 * ONE DIRECTION ONLY (Council Lens C): read tickets in (via {@link TaskProvider})
 * and push *one* status write back out. Full bidirectional sync (webhooks,
 * conflict resolution, divergent status semantics) is DEFERRED.
 *
 * Security (the load-bearing property): a ticket is **untrusted input** — its
 * title/body originate outside the trust boundary (lethal trifecta §3.3). The
 * status write-back is therefore an `external-write` capability DERIVED FROM
 * UNTRUSTED OUTPUT. It MUST pass the capability broker as a hard
 * `PermissionRequest` and can NEVER auto-fire. The orchestrator launders it
 * exactly like {@link AcpSession}: the agent/automation never clears its own
 * untrusted egress — only an explicit, per-call HUMAN decision does, executed as
 * the `human` principal. The append-only audit records both the untrusted gate
 * and the executed write (actor + capability + target, never a secret value).
 *
 * The worktree-creation and session-start steps are local first-party
 * primitives (B1/B2/B3) — they do not cross the trust boundary, so they run
 * directly. Only the external status write is gated.
 */

import type { GitWorktreeEntry } from "./worktree.ts";
import type { Ticket, TicketStatus } from "./workspace.ts";

/** The phases of the one-direction lifecycle this orchestrator drives. */
export type LifecyclePhase =
  /** Ticket pulled, worktree + session created, status pushed to In Progress. */
  | "in-progress"
  /** Work finished, diff+quality+review surfaced, status pushed to In Review. */
  | "in-review";

/**
 * The outcome of an external status write-back. Because the write crosses the
 * trust boundary from untrusted ticket data, it is gated: it is only `written`
 * when a human cleared the broker `ask`; otherwise it is `gated` (the broker
 * asked and the human declined / the gate was left to its fail-closed default)
 * — never silently dropped, never auto-fired.
 */
export type StatusWriteOutcome = "written" | "gated";

/** What `startTicket` produced — the local run, plus the gated status push. */
export interface TicketStartResult {
  ticket: Ticket;
  /** The session id created for this run (coupled to the worktree, §2.1). */
  sessionId: string;
  /** The worktree the run acts in. */
  worktree: GitWorktreeEntry;
  /** The status the ticket was moved to (`progress`). */
  targetStatus: TicketStatus;
  /** Whether the external status write was human-cleared or gated. */
  statusWrite: StatusWriteOutcome;
}

/** What `finishTicket` produced — the review hand-off, plus the gated push. */
export interface TicketFinishResult {
  ticketId: string;
  sessionId: string;
  /** The status the ticket was moved to (`review`). */
  targetStatus: TicketStatus;
  /** Whether the external status write was human-cleared or gated. */
  statusWrite: StatusWriteOutcome;
}

/**
 * The ticket-lifecycle orchestrator. Drives ticket → worktree → session →
 * status one direction. The external status write is broker-gated; the local
 * primitives run directly. A real adapter swaps the {@link TaskProvider} for a
 * live Jira/Linear client and the gated execution for the real PATCH — the gate
 * shape is unchanged.
 */
export interface TicketLifecycle {
  /**
   * Pull a ticket and bring its run up: create an isolated worktree, start a
   * session coupled to it, and push the ticket to `progress` (In Progress) —
   * the external write gated through the broker (untrusted-egress hard gate).
   * Throws if the ticket is unknown. The local worktree + session are created
   * regardless of the status-write gate outcome (the work can proceed locally
   * even when the external push is declined).
   */
  startTicket(ticketId: string): Promise<TicketStartResult>;
  /**
   * Mark a run finished: push the ticket to `review` (In Review) — again the
   * external write gated through the broker. The diff/quality/review surfacing
   * is the caller's (UI) concern; this method owns the status transition.
   */
  finishTicket(ticketId: string, sessionId: string): Promise<TicketFinishResult>;
}
