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
  BrokerDecision,
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
import type {
  AcpInitializeResult,
  AcpPermissionRequest,
  AcpToolCall,
} from "@/contracts";
import { ACP_METHODS, ACP_PROTOCOL_VERSION } from "@/contracts";
import { AcpTransport, type AgentNotification, type AgentRequest } from "./acp-transport.ts";
import {
  DEFAULT_TERSE_CONFIG,
  injectTerseDirective,
  type TerseConfig,
} from "./caveman-terse.ts";

/**
 * The human-in-the-loop resolver. Given the broker's `ask` request, returns a
 * decision. Lethal-trifecta egress (`fromUntrusted`) reaches here as a HARD gate
 * — the resolver is the only thing that can clear it, and only per-call. A
 * deny-returning resolver keeps the action blocked.
 */
export type PermissionResolver = (
  request: CapabilityRequest,
  context: { fromUntrusted: boolean; principal: Principal; sessionId: string },
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
  /**
   * Whether THIS session is untrusted by provenance (CLIENT-ASSIGNED TAINT). The
   * client — not the agent — owns the taint, derived from session provenance: a
   * ToDo / prompt / web / ticket-derived session is untrusted. Defaults to
   * `true` (any agent output is untrusted data until proven otherwise). The
   * agent's per-request `fromUntrusted` may only ESCALATE; it can never downgrade
   * an untrusted session to trusted. Effective taint = sessionUntrusted ||
   * request.fromUntrusted, so a hostile agent sending `fromUntrusted:false`
   * cannot dodge the lethal-trifecta gate.
   */
  untrusted?: boolean;
  /** Human-in-the-loop gate. Defaults to deny-all (fail closed). */
  resolvePermission?: PermissionResolver;
  /**
   * Run this turn INTO an existing store session instead of creating a new one
   * (road-to-agent-backend-enablement P2 — interactive chat continuity). When
   * set, `start` skips `store.create`, marks the existing session `running`, and
   * the streamed tool/permission/status events append to it. Absent (the
   * ToDo→agent default) → a fresh session is created, byte-identical to before.
   */
  existingSessionId?: string;
  /** Optional single-shot prod-write escape supplier. */
  writeEscape?: WriteEscapeSupplier;
  /** Spawn override for tests (command/args). Defaults to the stub agent. */
  command?: string;
  args?: string[];
  /**
   * Whether to run the ACP `initialize` handshake before `session/new` (B8 P2b).
   * The real `@zed-industries/claude-code-acp` bridge — and any standard ACP
   * agent CLI — REQUIRES this exchange first; the deterministic in-repo stub does
   * not. Defaults to `false` so the stub path stays byte-identical; the bridge
   * resolution path sets it to `true`. When set, `start` negotiates the protocol
   * version up front and fails fast if the agent cannot agree on it.
   */
  handshake?: boolean;
  /**
   * Perform an allowed action's side effect, inside the broker.execute context.
   * Defaults to a no-op (the deterministic test path only needs the gate + audit
   * proof). A real adapter would do the fs/shell/net work here.
   */
  perform?: (call: AcpToolCall) => void;
  /**
   * Caveman terse mode (Phase 2). Default-ON (opt-out per session). When enabled,
   * the vendored terse directive is PREPENDED to the agent prompt as system
   * context — shaping the model's EXPLANATION only. Border surfaces (diagnostics,
   * broker prompts, secret refs, audit, commit messages) never reach this and so
   * structurally never carry it (AK-T3 Caveman-Negativ-Assert).
   */
  terse?: TerseConfig;
}

const DENY_ALL: PermissionResolver = () => ({ axis: "deny" });

export class AcpSession {
  readonly #broker: CapabilityBroker;
  readonly #store: SessionStore;
  readonly #principal: Principal;
  /** CLIENT-ASSIGNED session-level taint (default true). The agent cannot lower it. */
  readonly #untrusted: boolean;
  readonly #resolve: PermissionResolver;
  /** Existing store session to run into (P2); empty → create a fresh one. */
  readonly #existingSessionId: string;
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
  /** Run the ACP `initialize` handshake before session/new (bridge path). */
  readonly #handshake: boolean;
  /** Caveman terse config (default ON, opt-out per session). */
  readonly #terse: TerseConfig;
  /** The exact system context sent to the agent (assert helper). */
  #sentSystemContext = "";
  /** Buffers streamed token deltas per messageId until the run reaches `done`. */
  readonly #tokenBuf = new Map<string, string>();

  constructor(opts: AcpSessionOptions) {
    this.#broker = opts.broker;
    this.#store = opts.store;
    this.#cwd = opts.cwd;
    this.#model = opts.model;
    this.#principal = opts.principal ?? { id: "acp-agent", kind: "agent", label: opts.model };
    // Default-untrusted: any agent output is untrusted data until the client
    // explicitly marks the session trusted (opts.untrusted === false).
    this.#untrusted = opts.untrusted ?? true;
    this.#resolve = opts.resolvePermission ?? DENY_ALL;
    this.#existingSessionId = opts.existingSessionId ?? "";
    this.#writeEscape = opts.writeEscape ?? (() => undefined);
    this.#perform = opts.perform ?? (() => {});
    this.#command = opts.command;
    this.#args = opts.args;
    this.#handshake = opts.handshake ?? false;
    this.#terse = opts.terse ?? DEFAULT_TERSE_CONFIG;
  }

  /** The store session id (after `start`). */
  get sessionId(): string {
    return this.#sessionId;
  }

  /**
   * The exact system-context+prompt string sent to the agent (Phase 2 assert
   * helper). Carries the terse directive marker when terse is on, not when off.
   */
  get sentSystemContext(): string {
    return this.#sentSystemContext;
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
    if (this.#existingSessionId) {
      // P2 — interactive chat: run this turn into the existing session. Skip
      // create; mark it running. Streamed tool/permission/status events append
      // to it (via #applyEvent → this.#sessionId), keeping one transcript.
      this.#sessionId = this.#existingSessionId;
      await this.#store.update(this.#sessionId, { status: "running" });
    } else {
      const stored = await this.#store.create({
        model: this.#model,
        title: prompt,
        status: "running",
        worktreePath: this.#cwd,
      });
      this.#sessionId = stored.id;
    }

    const done = new Promise<void>((resolve) => {
      this.#transport = new AcpTransport({
        command: this.#command,
        args: this.#args,
        onNotification: (note) => void this.#onNotification(note, resolve),
        onAgentRequest: (req) => this.#onAgentRequest(req),
      });
    });

    // P2b — ACP handshake. The real bridge (and any standard ACP CLI) requires
    // an `initialize` exchange before `session/new`: we announce the protocol
    // version + that the client mediates fs access (the broker seam), and the
    // agent replies with the version it agreed on. Fail fast on a mismatch the
    // agent cannot satisfy. The stub does not require this — gated by #handshake.
    if (this.#handshake) {
      const init = (await this.#transport!.request(ACP_METHODS.initialize, {
        protocolVersion: ACP_PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
      })) as AcpInitializeResult;
      if (init.protocolVersion !== ACP_PROTOCOL_VERSION) {
        throw new Error(
          `ACP protocol version mismatch: client speaks ${ACP_PROTOCOL_VERSION}, agent agreed ${init.protocolVersion}`,
        );
      }
    }

    const newSession = (await this.#transport!.request(ACP_METHODS.newSession, {
      cwd: this.#cwd,
      model: this.#model,
      sessionId: this.#sessionId,
    })) as { sessionId: string };
    // CAVEMAN TERSE (Phase 2): prepend the vendored terse directive as system
    // context (default ON, opt-out per session). Shapes the model's EXPLANATION
    // only; the user/ToDo prompt below the marker is unchanged (still untrusted).
    // Border surfaces never pass through here → structurally cannot carry it.
    const sentPrompt = injectTerseDirective(prompt, this.#terse);
    this.#sentSystemContext = sentPrompt;
    // Prompt the agent. The prompt becomes UNTRUSTED data once it round-trips.
    // Fire-and-forget: completion is driven by the `done` notification, not this
    // request's response. A `.catch` absorbs the rejection that `#onClose` raises
    // for any still-pending request when the agent process closes on teardown —
    // otherwise that benign rejection surfaces as an unhandled rejection (vitest
    // flags it as a possible false positive even though the run completed).
    void this.#transport!.request(ACP_METHODS.prompt, {
      sessionId: newSession.sessionId,
      prompt: sentPrompt,
    }).catch(() => {});

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
      // Assemble the agent's streamed reply (buffered token deltas) into a
      // durable message block BEFORE marking the session done — closes the
      // gap left by #applyEvent's deliberate non-persistence of `token`.
      await this.#flushAgentMessage();
      await this.#store.update(this.#sessionId, { status: "done" });
      finish();
    }
  }

  /**
   * Append one agent message block per buffered messageId with non-empty text,
   * then clear the buffer. Additive: turns the streamed token deltas into the
   * durable transcript shape `Message` already supports.
   */
  async #flushAgentMessage(): Promise<void> {
    for (const [messageId, text] of this.#tokenBuf) {
      if (text.length === 0) continue;
      await this.#store.append(this.#sessionId, {
        type: "message",
        block: { id: messageId, role: "agent", body: text },
      });
    }
    this.#tokenBuf.clear();
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
      // token deltas are streamed to subscribers AND accumulated per messageId;
      // the assembled agent message is appended to the store on the `done` path
      // (#flushAgentMessage), closing the streamed-message persistence gap.
      case "token":
        this.#tokenBuf.set(
          event.messageId,
          (this.#tokenBuf.get(event.messageId) ?? "") + event.delta,
        );
        break;
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
    // CLIENT-ASSIGNED TAINT: the client owns the taint, NOT the agent. The
    // agent's `fromUntrusted` flag may only ESCALATE — it can never downgrade an
    // untrusted session. Effective taint = sessionUntrusted || agentFlag, so a
    // hostile agent sending `fromUntrusted:false` on an egress in an untrusted
    // session is STILL forced through the lethal-trifecta gate.
    const effectiveUntrusted = this.#untrusted || Boolean(fromUntrusted);
    const request: CapabilityRequest = {
      kind: call.kind,
      target: call.target,
      command: call.command,
      credentialRef: call.credentialRef,
      fromUntrusted: effectiveUntrusted,
    };

    // 1. Authorize through the broker AS THE AGENT (writes the append-only audit
    //    BEFORE any execution). The agent's request keeps `fromUntrusted` — so an
    //    untrusted egress is forced to `ask` here and can NEVER auto-fire. This
    //    audited authorize is the lethal-trifecta gate (MUST-NOT 4). On `allow`
    //    it also mints the single-use execution grant `execute` requires (C3).
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
    // The execution grant bound to (execPrincipal × execRequest). On the direct
    // `allow` path it is the agent's grant from above; the human path mints a
    // fresh one (C3).
    let execDecision: BrokerDecision = decision;

    // 2. On `ask`, the human-in-the-loop gate decides (the ONLY thing that can
    //    clear an `ask`, including a lethal-trifecta egress, and only per-call).
    if (decision.outcome === "ask") {
      const human = await this.#resolve(request, {
        fromUntrusted: effectiveUntrusted,
        principal: this.#principal,
        sessionId: this.#sessionId,
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
      // C3 — obtain the single-use execution grant for the HUMAN-cleared
      // (trusted) request. This is the human-laundering path: a fresh, audited
      // authorize on the human's authority binds the grant `execute` requires.
      execDecision = this.#broker.authorize(humanPrincipal, trusted);
      if (execDecision.outcome !== "allow") {
        return { outcome: "deny", reason: "human grant did not clear the gate" };
      }
    }

    // 3. EXECUTE through the broker chokepoint (consumes the execution grant,
    //    writes the `executed` audit, injects secrets only at the execution
    //    layer). The action's side effect runs inside this callback — never
    //    outside it. `execute` requires the matching grant: a forged "trusted"
    //    request has no grant and cannot run (C3).
    try {
      this.#broker.execute(
        execPrincipal,
        execRequest,
        () => this.#perform(call),
        { writeEscape: this.#writeEscape(execRequest), grant: execDecision.grant },
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
