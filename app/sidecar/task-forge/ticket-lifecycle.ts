/**
 * {@link TicketLifecycle} impl (B6 Phase 1) — the one-direction north-star slice.
 *
 * Composes the four primitives already built:
 *  - {@link TaskProvider}        — read the ticket (untrusted input).
 *  - {@link WorktreeOpsProvider} — create the isolated checkout (B2, local).
 *  - {@link SessionStore}        — start the run coupled to the worktree (B3).
 *  - {@link CapabilityBroker}    — gate the EXTERNAL status write-back (B4).
 *
 * The single security-bearing property: the status write to the ticket system
 * is an `external-write` derived from untrusted ticket data, so it is laundered
 * exactly like AcpSession's untrusted egress —
 *   1. `broker.authorize(automation, {kind:"external-write", fromUntrusted:true})`
 *      → ALWAYS `ask` (the broker can never auto-grant untrusted egress), audited.
 *   2. The per-call human resolver decides. A `deny` (incl. the fail-closed
 *      default) leaves the write `gated` — the external status never changes.
 *   3. Only a human-cleared call `broker.execute(human, trustedRequest, …)` —
 *      the write runs as the `human` principal over a request stripped of
 *      `fromUntrusted` (a human vetted it). The local worktree/session still came
 *      up; only the external push obeys the gate.
 *
 * Deterministic: no Date.now / Math.random; the store/worktree carry their own
 * monotonic ordering. The actual external PATCH is `performWrite` (default
 * no-op) — a real Jira/Linear adapter does the HTTP there, with any token
 * injected at the execution layer via `ctx.withSecret`, never on the wire.
 */

import type {
  CapabilityBroker,
  CapabilityRequest,
  PermissionDecision,
  Principal,
  SessionStore,
  StatusWriteOutcome,
  TaskProvider,
  Ticket,
  TicketFinishResult,
  TicketLifecycle,
  TicketStartResult,
  TicketStatus,
  WorktreeOpsProvider,
} from "@/contracts";

/**
 * The human-in-the-loop resolver for the status write-back. Given the broker's
 * `ask`, returns a per-call decision. The untrusted-egress gate reaches here as
 * a HARD gate — only this resolver clears it, and only per call. Defaults to
 * deny-all (fail closed).
 */
export type StatusWriteResolver = (
  request: CapabilityRequest,
  context: { ticket: Ticket | undefined; targetStatus: TicketStatus },
) => Promise<PermissionDecision> | PermissionDecision;

/** Perform the actual external status PATCH (real adapter); default no-op. */
export type PerformStatusWrite = (input: {
  ticketId: string;
  targetStatus: TicketStatus;
}) => void;

export interface TicketLifecycleOptions {
  task: TaskProvider;
  worktree: WorktreeOpsProvider;
  store: SessionStore;
  broker: CapabilityBroker;
  /** Repo root the worktrees are created under (the main worktree path). */
  repoCwd: string;
  /**
   * Directory factory for a ticket's worktree path. Defaults to a `.worktrees/`
   * sibling keyed by ticket id (deterministic).
   */
  worktreePath?: (ticketId: string) => string;
  /** Branch name for a ticket's worktree. Defaults to `ticket/<id>`. */
  branchName?: (ticketId: string) => string;
  /** Model the session is created with. Defaults to a deterministic id. */
  model?: string;
  /** Human gate for the external status write. Defaults to deny-all. */
  resolveStatusWrite?: StatusWriteResolver;
  /** The external PATCH side effect (real adapter). Default no-op. */
  performStatusWrite?: PerformStatusWrite;
}

const DENY_ALL: StatusWriteResolver = () => ({ axis: "deny" });

/** The automation principal — its derived egress is untrusted (lethal trifecta). */
const AUTOMATION: Principal = { id: "lifecycle", kind: "agent", label: "Ticket lifecycle" };
const HUMAN: Principal = { id: "human", kind: "human", label: "You" };

export class TicketLifecycleImpl implements TicketLifecycle {
  readonly #task: TaskProvider;
  readonly #worktree: WorktreeOpsProvider;
  readonly #store: SessionStore;
  readonly #broker: CapabilityBroker;
  readonly #repoCwd: string;
  readonly #worktreePath: (ticketId: string) => string;
  readonly #branchName: (ticketId: string) => string;
  readonly #model: string;
  readonly #resolve: StatusWriteResolver;
  readonly #perform: PerformStatusWrite;

  constructor(opts: TicketLifecycleOptions) {
    this.#task = opts.task;
    this.#worktree = opts.worktree;
    this.#store = opts.store;
    this.#broker = opts.broker;
    this.#repoCwd = opts.repoCwd;
    this.#worktreePath =
      opts.worktreePath ?? ((id) => `${opts.repoCwd}/.worktrees/${id}`);
    this.#branchName = opts.branchName ?? ((id) => `ticket/${id}`);
    this.#model = opts.model ?? "lifecycle/stub";
    this.#resolve = opts.resolveStatusWrite ?? DENY_ALL;
    this.#perform = opts.performStatusWrite ?? (() => {});
  }

  async startTicket(ticketId: string): Promise<TicketStartResult> {
    const ticket = await this.#task.getTicket(ticketId);
    if (!ticket) throw new Error(`unknown ticket: ${ticketId}`);

    // 1. Create the isolated worktree (B2, local first-party primitive — no
    //    trust boundary crossed, runs directly). Couple it to the session id we
    //    are about to create (§2.1 worktree lifecycle == session lifecycle).
    const stored = await this.#store.create({
      model: this.#model,
      title: `${ticket.id} ${ticket.title}`,
      status: "running",
    });
    const path = this.#worktreePath(ticketId);
    const entry = await this.#worktree.create(this.#repoCwd, path, {
      branch: this.#branchName(ticketId),
      newBranch: true,
      sessionId: stored.id,
    });
    // Record the coupling on the session record too.
    await this.#store.update(stored.id, { worktreePath: entry.path });

    // 2. Push status → In Progress (`progress`). EXTERNAL write derived from
    //    untrusted ticket data → broker-gated, never auto-fired.
    const targetStatus: TicketStatus = "progress";
    const statusWrite = await this.#writeStatus(ticket, targetStatus);

    return { ticket, sessionId: stored.id, worktree: entry, targetStatus, statusWrite };
  }

  async finishTicket(ticketId: string, sessionId: string): Promise<TicketFinishResult> {
    const ticket = await this.#task.getTicket(ticketId);
    // Marking the run done locally is a first-party store update (no boundary).
    await this.#store.update(sessionId, { status: "done" });

    // Push status → In Review (`review`). EXTERNAL write, same untrusted-egress
    // gate as start.
    const targetStatus: TicketStatus = "review";
    const statusWrite = await this.#writeStatus(ticket, targetStatus);

    return { ticketId, sessionId, targetStatus, statusWrite };
  }

  /**
   * Gate + (maybe) perform the external status write. This is the laundering
   * seam — the automation never clears its own untrusted egress; only a per-call
   * human decision does. Returns `written` only when a human cleared it.
   */
  async #writeStatus(
    ticket: Ticket | undefined,
    targetStatus: TicketStatus,
  ): Promise<StatusWriteOutcome> {
    const ticketId = ticket?.id ?? "(unknown)";
    // The external-write capability, marked as DERIVED FROM UNTRUSTED OUTPUT
    // (the ticket). `target` names the concrete object — never a secret.
    const request: CapabilityRequest = {
      kind: "external-write",
      target: `${this.#task.backend}:ticket:${ticketId}:status=${targetStatus}`,
      fromUntrusted: true,
    };

    // 1. Authorize as the AUTOMATION (writes the append-only audit BEFORE any
    //    execution). Untrusted egress is forced to `ask` here — the broker can
    //    never auto-grant it (MUST-NOT 4 / lethal trifecta).
    const decision = this.#broker.authorize(AUTOMATION, request);
    if (decision.outcome === "deny") return "gated";
    if (decision.outcome === "allow") {
      // The broker must never allow untrusted egress outright. If a future
      // misconfiguration did, refuse rather than auto-write — defence in depth.
      return "gated";
    }

    // 2. Per-call human decision — the ONLY thing that clears the gate.
    const human = await this.#resolve(request, { ticket, targetStatus });
    if (human.axis === "deny") {
      this.#broker.resolve(AUTOMATION, request, human);
      return "gated";
    }

    // 3. The human vetted THIS action and accepts responsibility (§3.1). Execute
    //    as the HUMAN principal over a TRUSTED request (no `fromUntrusted`), so
    //    the broker's re-decide allows it. Record the human grant first.
    const trusted: CapabilityRequest = {
      kind: request.kind,
      target: request.target,
    };
    this.#broker.resolve(HUMAN, trusted, human);
    // C3 — obtain the single-use execution grant for the human-cleared trusted
    // request. `execute` requires this exact grant; a forged trusted request
    // would have none. If the gate did not clear to `allow`, stay gated.
    const grantDecision = this.#broker.authorize(HUMAN, trusted);
    if (grantDecision.outcome !== "allow") return "gated";
    try {
      this.#broker.execute(
        HUMAN,
        trusted,
        () => {
          this.#perform({ ticketId, targetStatus });
        },
        { grant: grantDecision.grant },
      );
    } catch {
      // The broker refused at the execution edge (e.g. `once` cannot re-decide).
      // The local run already came up; the external write stays gated.
      return "gated";
    }
    return "written";
  }
}
