/**
 * AcpSession (B3 Phase 1) — the driver that wires the ACP transport to the
 * three other primitives, and ENFORCES the load-bearing invariant:
 *
 *   EVERY tool / shell / file / net access the agent requests goes through the
 *   capability broker (B4). The agent (stub or real) has no other path — it can
 *   only `session/request_permission`, and this driver answers it exclusively
 *   via `broker.authorize` → human gate → `broker.execute`. There is no code
 *   path here that performs an agent-requested action without the broker.
 *
 * Flow:
 *  - `start(cwd, model, prompt)` creates a {@link SessionStore} record (coupled
 *    to the worktree `cwd`, §2.1), spawns the agent, runs `session/new` +
 *    `session/prompt`.
 *  - Agent `session/update` notifications → translated to {@link SessionEvent}s,
 *    appended into the store AND pushed to subscribers (the subscribe channel).
 *  - Agent `session/request_permission` → `broker.authorize`. On `ask`, the
 *    human-in-the-loop `resolvePermission` callback decides (lethal-trifecta
 *    egress is forced through this gate and can never auto-fire). On allow, the
 *    action is performed *by the client* through `broker.execute` (the chokepoint),
 *    then `{outcome:"allow"}` is returned to the agent. On deny, `{outcome:"deny"}`.
 *
 * A `deny` (or an unresolved untrusted-egress gate left to default) means the
 * agent's scripted action never runs — proving the broker is un-bypassable.
 */

import type {
  CapabilityBroker,
  CapabilityRequest,
  PermissionDecision,
  Principal,
  SessionEvent,
  SessionListener,
  SessionStore,
  Unsubscribe,
  WriteEscape,
} from "@/contracts";
import type { AcpPermissionRequest, AcpToolCall } from "@/contracts";
import { ACP_METHODS } from "@/contracts";
import { AcpTransport, type AgentNotification, type AgentRequest } from "./acp-transport.ts";

/**
 * The human-in-the-loop resolver. Given the broker's `ask` request, returns a
 * decision. Lethal-trifecta egress (`fromUntrusted`) reaches here as a HARD gate
 * — the resolver is the only thing that can clear it, and only per-call. A
 * deny-returning resolver keeps the action blocked.
 */
export type PermissionResolver = (
  request: CapabilityRequest,
  context: { fromUntrusted: boolean; principal: Principal },
) => Promise<PermissionDecision> | PermissionDecision;

/** A single-shot write escape supplier for prod db-write (kept narrow; §3.3). */
export type WriteEscapeSupplier = (request: CapabilityRequest) => WriteEscape | undefined;

export interface AcpSessionOptions {
  broker: CapabilityBroker;
  store: SessionStore;
  /** Worktree the run acts in (§2.1). */
  cwd: string;
  model: string;
  /** The agent principal (its output is untrusted DATA — lethal trifecta). */
  principal?: Principal;
  /** Human-in-the-loop gate. Defaults to deny-all (fail closed). */
  resolvePermission?: PermissionResolver;
  /** Optional single-shot prod-write escape supplier. */
  writeEscape?: WriteEscapeSupplier;
  /** Spawn override for tests (command/args). Defaults to the stub agent. */
  command?: string;
  args?: string[];
  /**
   * Perform an allowed action's side effect, inside the broker.execute context.
   * Defaults to a no-op (the deterministic test path only needs the gate + audit
   * proof). A real adapter would do the fs/shell/net work here.
   */
  perform?: (call: AcpToolCall) => void;
}

const DENY_ALL: PermissionResolver = () => ({ axis: "deny" });

export class AcpSession {
  readonly #broker: CapabilityBroker;
  readonly #store: SessionStore;
  readonly #principal: Principal;
  readonly #resolve: PermissionResolver;
  readonly #writeEscape: WriteEscapeSupplier;
  readonly #perform: (call: AcpToolCall) => void;
  readonly #listeners = new Set<SessionListener>();
  #transport: AcpTransport | null = null;
  /** The store session id (created up front, coupled to the worktree). */
  #sessionId = "";
  #cwd: string;
  #model: string;
  #command?: string;
  #args?: string[];

  constructor(opts: AcpSessionOptions) {
    this.#broker = opts.broker;
    this.#store = opts.store;
    this.#cwd = opts.cwd;
    this.#model = opts.model;
    this.#principal = opts.principal ?? { id: "acp-agent", kind: "agent", label: opts.model };
    this.#resolve = opts.resolvePermission ?? DENY_ALL;
    this.#writeEscape = opts.writeEscape ?? (() => undefined);
    this.#perform = opts.perform ?? (() => {});
    this.#command = opts.command;
    this.#args = opts.args;
  }

  /** The store session id (after `start`). */
  get sessionId(): string {
    return this.#sessionId;
  }

  /** Subscribe to this session's live event stream (ACP-shaped). */
  subscribe(listener: SessionListener): Unsubscribe {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #emit(event: SessionEvent): void {
    for (const l of this.#listeners) l(event);
  }

  /**
   * Start the run: create the store record, spawn the agent, prompt it, and
   * stream until the agent emits `done`. Resolves the store session id.
   */
  async start(prompt: string): Promise<string> {
    const stored = await this.#store.create({
      model: this.#model,
      title: prompt,
      status: "running",
      worktreePath: this.#cwd,
    });
    this.#sessionId = stored.id;

    const done = new Promise<void>((resolve) => {
      this.#transport = new AcpTransport({
        command: this.#command,
        args: this.#args,
        onNotification: (note) => void this.#onNotification(note, resolve),
        onAgentRequest: (req) => this.#onAgentRequest(req),
      });
    });

    const newSession = (await this.#transport!.request(ACP_METHODS.newSession, {
      cwd: this.#cwd,
      model: this.#model,
      sessionId: this.#sessionId,
    })) as { sessionId: string };
    // Prompt the agent. The prompt becomes UNTRUSTED data once it round-trips.
    void this.#transport!.request(ACP_METHODS.prompt, {
      sessionId: newSession.sessionId,
      prompt,
    });

    await done;
    return this.#sessionId;
  }

  async #onNotification(note: AgentNotification, finish: () => void): Promise<void> {
    if (note.method !== ACP_METHODS.update) return;
    const params = note.params as { sessionId: string; event: SessionEvent };
    const event = params.event;
    await this.#applyEvent(event);
    this.#emit(event);
    if (event.type === "done") {
      await this.#store.update(this.#sessionId, { status: "done" });
      finish();
    }
  }

  /** Persist an event into the session store (tokens/tools/status/telemetry). */
  async #applyEvent(event: SessionEvent): Promise<void> {
    switch (event.type) {
      case "tool":
        await this.#store.append(this.#sessionId, { type: "tool", block: event.block });
        break;
      case "permission":
        await this.#store.append(this.#sessionId, { type: "permission", block: event.request });
        break;
      case "status":
        await this.#store.update(this.#sessionId, { status: event.status });
        break;
      case "telemetry":
        await this.#store.update(this.#sessionId, { telemetry: event.telemetry });
        break;
      // token deltas are streamed to subscribers; the store keeps tool/perm/status
      // records (the durable transcript shape). A real store would also assemble
      // the streamed message — out of scope for the deterministic spine proof.
      case "token":
      case "done":
        break;
    }
  }

  /**
   * The BROKER SEAM. The agent asks to perform a capability; we answer ONLY
   * through the broker. No agent-requested action runs without it.
   */
  async #onAgentRequest(req: AgentRequest): Promise<unknown> {
    if (req.method !== ACP_METHODS.requestPermission) {
      throw new Error(`unsupported agent request: ${req.method}`);
    }
    const { call, fromUntrusted } = req.params as AcpPermissionRequest;
    const request: CapabilityRequest = {
      kind: call.kind,
      target: call.target,
      command: call.command,
      credentialRef: call.credentialRef,
      fromUntrusted,
    };

    // 1. Authorize through the broker AS THE AGENT (writes the append-only audit
    //    BEFORE any execution). The agent's request keeps `fromUntrusted` — so an
    //    untrusted egress is forced to `ask` here and can NEVER auto-fire. This
    //    audited authorize is the lethal-trifecta gate (MUST-NOT 4).
    const decision = this.#broker.authorize(this.#principal, request);

    if (decision.outcome === "deny") {
      return { outcome: "deny", reason: decision.reason };
    }

    // The principal/request actually authorized for EXECUTION. For an allowlisted
    // (trusted, `allow`) capability that is the agent itself. For anything that
    // requires a human decision (`ask`, incl. untrusted egress), it becomes the
    // HUMAN — §3.1: the human is the responsible principal who reviewed and
    // cleared this one action. The agent never clears its own untrusted egress;
    // only an explicit, per-call human decision does (§3.3 laundering).
    let execPrincipal = this.#principal;
    let execRequest = request;

    // 2. On `ask`, the human-in-the-loop gate decides (the ONLY thing that can
    //    clear an `ask`, including a lethal-trifecta egress, and only per-call).
    if (decision.outcome === "ask") {
      const human = await this.#resolve(request, {
        fromUntrusted: Boolean(fromUntrusted),
        principal: this.#principal,
      });
      if (human.axis === "deny") {
        this.#broker.resolve(this.#principal, request, human);
        return { outcome: "deny", reason: "human denied" };
      }
      // The human reviewed THIS action and accepted responsibility. Execution
      // proceeds on the human's authority over a request that is no longer
      // "derived from untrusted output" (a human vetted it). The agent's
      // untrusted authorize above stays in the audit as the gate record.
      const humanPrincipal: Principal = { id: "human", kind: "human", label: "You" };
      const trusted: CapabilityRequest = {
        kind: request.kind,
        target: request.target,
        command: request.command,
        credentialRef: request.credentialRef,
      };
      execPrincipal = humanPrincipal;
      execRequest = trusted;
      // Record the human grant — passing the ORIGINAL request (which still
      // carries `fromUntrusted`). §3.3 lethal trifecta: the policy engine is
      // the chokepoint that decides what may persist. For an untrusted-derived
      // egress it clamps any session/scoped choice to a single-use grant
      // (per-call only, never persistable), so this one approved call still
      // executes (execute's re-decide consumes it) but can NEVER launder into
      // a standing grant that auto-clears future trusted egress. For a normal
      // (trusted) `ask`, a `session` grant persists for the run as before.
      this.#broker.resolve(humanPrincipal, request, human);
    }

    // 3. EXECUTE through the broker chokepoint (re-authorizes, writes the
    //    `executed` audit, injects secrets only at the execution layer). The
    //    action's side effect runs inside this callback — never outside it.
    try {
      this.#broker.execute(
        execPrincipal,
        execRequest,
        () => this.#perform(call),
        { writeEscape: this.#writeEscape(execRequest) },
      );
    } catch (err) {
      return { outcome: "deny", reason: err instanceof Error ? err.message : String(err) };
    }
    return { outcome: "allow", reason: "broker authorized + executed" };
  }

  /** Stop the run + tear down the agent process. */
  close(): void {
    this.#transport?.close();
    this.#transport = null;
    this.#listeners.clear();
  }
}
