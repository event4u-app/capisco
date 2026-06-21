/**
 * PendingPermissionRegistry (LIVE human-in-the-loop gate) — the missing seam
 * that lets a real, running agent session's `ask` be approved or denied FROM THE
 * UI over the IPC spine.
 *
 * The broker + {@link AcpSession}/{@link ClaudeCodeProvider} already enforce the
 * load-bearing invariant: every agent capability is authorized through the
 * broker, and an `ask` (including a lethal-trifecta untrusted egress) can ONLY be
 * cleared by the session's {@link PermissionResolver}. Until now the dev bridge
 * supplied NO resolver for live sessions, so the session defaulted to deny-all and
 * the agent was blocked at the first gate. This registry IS that resolver — but
 * instead of deciding synchronously, it parks the `ask`, surfaces it to the UI,
 * and AWAITS the human's decision returned over IPC.
 *
 *   THE RESOLVER IS THE ONLY THING THAT CLEARS AN `ask` (acp-session §2). This
 *   registry never auto-allows: a parked request stays pending until either the
 *   UI resolves it OR the bounded wait elapses with no client — both fail CLOSED
 *   (deny). It does not, and cannot, widen the broker's allowlist; it only relays
 *   a per-call human decision (once / session / deny) back into the broker via
 *   the resolver return value. For untrusted egress the policy engine already
 *   clamps any session/scoped choice to a single-use grant — this registry passes
 *   the human's chosen axis through verbatim and lets the engine do that clamping.
 *
 * Surface for the IPC `agent` provider (agent-proxy):
 *  - {@link resolverFor}        — the per-session {@link PermissionResolver} the
 *    live session is started with.
 *  - {@link getPendingPermission} — what `agent.getPendingPermission(sessionId)`
 *    returns: the parked {@link PermissionRequest} or null.
 *  - {@link resolvePermission}  — what `agent.resolvePermission(sessionId,
 *    requestId, decision)` calls: clears the parked request, resolves the awaited
 *    Promise, returns the {@link GrantAxis}.
 *  - {@link subscribe}          — a per-session event channel so the UI is pushed
 *    a `permission` event the instant a gate parks (no polling needed when live).
 */

import type {
  CapabilityRequest,
  GrantAxis,
  PermissionDecision,
  PermissionRequest,
  Principal,
  SessionEvent,
  SessionListener,
  Unsubscribe,
} from "@/contracts";
import type { PermissionResolver } from "./acp-session.ts";

/** A parked `ask` awaiting the UI's decision. */
interface PendingEntry {
  request: PermissionRequest;
  /** Resolve the awaited resolver Promise with the human decision. */
  settle: (decision: PermissionDecision) => void;
  /** Bounded fail-closed timer handle (cleared on resolve). */
  timer: ReturnType<typeof setTimeout> | null;
}

export interface PendingPermissionRegistryOptions {
  /**
   * Bounded fail-closed wait: if no UI resolves a parked `ask` within this many
   * ms, the resolver settles `deny` so a live agent can never hang forever and an
   * unattended bridge can never leak an auto-grant. `0` disables the timer (used
   * by integration tests that resolve deterministically). Default 5 minutes.
   */
  resolveTimeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5 * 60_000;

/** Stable, deterministic request-id derivation (no Date.now / Math.random). */
function deriveRequestId(sessionId: string, seq: number): string {
  return `${sessionId}:perm-${seq}`;
}

export class PendingPermissionRegistry {
  /** sessionId → the single parked `ask` for that session (one at a time). */
  readonly #pending = new Map<string, PendingEntry>();
  /** sessionId → live subscribers (the UI's event stream). */
  readonly #listeners = new Map<string, Set<SessionListener>>();
  /** Per-session monotonic counter for deterministic request ids. */
  readonly #seq = new Map<string, number>();
  readonly #timeoutMs: number;

  constructor(opts: PendingPermissionRegistryOptions = {}) {
    this.#timeoutMs = opts.resolveTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * The single {@link PermissionResolver} every live session is started with. On
   * an `ask` it parks the request UNDER THE SESSION'S OWN ID (carried in the
   * resolver context by {@link AcpSession}/{@link ClaudeCodeProvider}), emits a
   * `permission` event to subscribers, and returns a Promise that resolves when
   * {@link resolvePermission} is called (or denies on the bounded timeout). The
   * session's broker seam awaits this Promise — the agent stays blocked until the
   * human (or the fail-closed timer) decides. One resolver serves every session;
   * the per-session keying is the context `sessionId`, so a single registry fronts
   * all live runs over one IPC `agent` provider.
   */
  readonly resolver: PermissionResolver = (
    request: CapabilityRequest,
    context: { fromUntrusted: boolean; principal: Principal; sessionId: string },
  ) => this.#park(context.sessionId, request, context.fromUntrusted);

  #park(
    sessionId: string,
    request: CapabilityRequest,
    fromUntrusted: boolean,
  ): Promise<PermissionDecision> {
    // A new parked `ask` supersedes any earlier unresolved one for this session
    // (fail-closed: deny the stale one so its session's broker seam unblocks).
    this.#clear(sessionId, { axis: "deny" });

    const seq = (this.#seq.get(sessionId) ?? 0) + 1;
    this.#seq.set(sessionId, seq);
    const requestId = deriveRequestId(sessionId, seq);

    const permissionRequest: PermissionRequest = {
      id: requestId,
      command: `${request.kind}(${request.target})`,
      label: request.target,
      // The three canonical scopes the PermissionPrompt offers. The UI maps the
      // chosen scope back to a PermissionDecision axis.
      scopes: ["Allow once", "This session", "Deny"],
      credentialRef: request.credentialRef,
      fromUntrusted: fromUntrusted || request.fromUntrusted,
    };

    return new Promise<PermissionDecision>((resolve) => {
      const timer =
        this.#timeoutMs > 0
          ? setTimeout(() => {
              // Bounded fail-closed: no UI decided in time → deny.
              this.#clear(sessionId, { axis: "deny" });
            }, this.#timeoutMs)
          : null;
      this.#pending.set(sessionId, { request: permissionRequest, settle: resolve, timer });
      this.#emit(sessionId, { type: "permission", request: permissionRequest });
    });
  }

  /** The parked `ask` for a session, or null. Backs `agent.getPendingPermission`. */
  getPendingPermission(sessionId: string): PermissionRequest | null {
    return this.#pending.get(sessionId)?.request ?? null;
  }

  /**
   * Resolve a parked `ask` with the human's decision. Backs
   * `agent.resolvePermission`. A `requestId` that does not match the currently
   * parked request is ignored (stale UI click) and reported as `deny` — the
   * resolver never clears on a mismatched id. Returns the chosen {@link GrantAxis}
   * (the broker/policy-engine performs the untrusted-egress clamping downstream).
   */
  resolvePermission(
    sessionId: string,
    requestId: string,
    decision: PermissionDecision,
  ): GrantAxis {
    const entry = this.#pending.get(sessionId);
    if (!entry || entry.request.id !== requestId) {
      // No matching parked request — fail closed, never settle a stale promise.
      return "deny";
    }
    this.#clear(sessionId, decision);
    return decision.axis;
  }

  /**
   * Settle and remove the parked entry for a session with the given decision,
   * clearing its fail-closed timer. A `done`/teardown path can call this with a
   * `deny` to unblock a hung session.
   */
  #clear(sessionId: string, decision: PermissionDecision): void {
    const entry = this.#pending.get(sessionId);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    this.#pending.delete(sessionId);
    entry.settle(decision);
  }

  /**
   * Subscribe to a session's live permission event stream. The IPC server's
   * `agent.subscribe` forwards these to the browser, so a parked `ask` reaches
   * the UI instantly (the UI may also poll `getPendingPermission` as a fallback).
   */
  subscribe(sessionId: string, listener: SessionListener): Unsubscribe {
    let set = this.#listeners.get(sessionId);
    if (!set) {
      set = new Set();
      this.#listeners.set(sessionId, set);
    }
    set.add(listener);
    // If a request is already parked, push it immediately so a late subscriber
    // still sees the pending gate without a poll.
    const parked = this.#pending.get(sessionId);
    if (parked) listener({ type: "permission", request: parked.request });
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) this.#listeners.delete(sessionId);
    };
  }

  #emit(sessionId: string, event: SessionEvent): void {
    const set = this.#listeners.get(sessionId);
    if (!set) return;
    for (const l of set) l(event);
  }

  /** Fail-closed teardown — deny every still-parked `ask` (e.g. on shutdown). */
  denyAll(): void {
    for (const sessionId of [...this.#pending.keys()]) {
      this.#clear(sessionId, { axis: "deny" });
    }
  }
}
