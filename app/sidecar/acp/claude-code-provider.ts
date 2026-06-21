/**
 * ClaudeCodeProvider (B8 Phase 2a) — the NATIVE Claude-Code backend driver.
 *
 * The installed `claude` CLI speaks the SDK stream-json mode, not ACP. This is
 * the native sibling of {@link AcpSession}: same session interface (a `start` +
 * a `subscribe` event channel), same un-bypassable broker seam, but driving the
 * stream-json transport instead of the ACP stdio protocol. It is selectable as a
 * backend behind the same surface as the stub/ACP path.
 *
 *   LOAD-BEARING INVARIANT (identical to AcpSession): EVERY tool the model wants
 *   to run is routed through the capability broker (B4) — `broker.authorize` →
 *   human gate → `broker.execute`. There is NO code path that performs a
 *   model-requested action without the broker. A `deny` (or an unresolved
 *   untrusted-egress gate) means the action never runs.
 *
 * Flow:
 *  - `start(prompt)` creates a {@link SessionStore} record (coupled to the
 *    worktree `cwd`), spawns the sealed `claude` child, and writes the prompt as
 *    a stream-json `user` envelope.
 *  - Each stdout envelope → {@link parseStreamJsonEnvelope}. SessionEvents
 *    (token/status/telemetry) are appended to the store AND pushed to subscribers.
 *  - Each assistant `tool_use` → the BROKER SEAM (`#onToolCall`): authorize as the
 *    agent (audited, untrusted), human-gate an `ask`, execute as the human on the
 *    trusted request form (§3.3 laundering, C3 single-use grant). Only on a
 *    cleared gate is the tool recorded as an executed `tool` SessionEvent and the
 *    side effect performed inside `broker.execute` (the chokepoint).
 *  - The terminal `result` envelope marks the run `done`.
 *
 * CLIENT-ASSIGNED TAINT (Red-team Fix 1): the SESSION carries the egress taint
 * (`#untrusted`, default `true`) — the model's output never downgrades it. A
 * native run is untrusted by provenance exactly like an ACP run; the model's
 * tool_use derived from the (untrusted) prompt hits the lethal-trifecta gate.
 *
 * NO RAW KEY (hard rule): the native path uses the EXISTING `claude` login — the
 * CLI reads its own auth. No credential is introduced, none reaches the sealed
 * child env/argv, none is referenced here.
 */

import type {
  AcpToolCall,
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
import { ClaudeStreamTransport } from "./claude-stream-exec.ts";
import { parseStreamJsonEnvelope, type StreamJsonEnvelope } from "./stream-json-parse.ts";
import {
  DEFAULT_TERSE_CONFIG,
  injectTerseDirective,
  type TerseConfig,
} from "./caveman-terse.ts";

/**
 * The human-in-the-loop resolver — identical shape to the ACP one. Lethal-trifecta
 * egress reaches here as a HARD gate; the resolver is the only thing that clears
 * an `ask`, and only per-call. Defaults to deny-all (fail closed).
 */
export type PermissionResolver = (
  request: CapabilityRequest,
  context: { fromUntrusted: boolean; principal: Principal; sessionId: string },
) => Promise<PermissionDecision> | PermissionDecision;

/** A single-shot write-escape supplier for prod db-write (kept narrow; §3.3). */
export type WriteEscapeSupplier = (request: CapabilityRequest) => WriteEscape | undefined;

export interface ClaudeCodeProviderOptions {
  broker: CapabilityBroker;
  store: SessionStore;
  /** Worktree the run acts in (§2.1). */
  cwd: string;
  /** Model/agent label for the transcript. Defaults to "Claude Code (native)". */
  model?: string;
  /** The agent principal (its output is untrusted DATA — lethal trifecta). */
  principal?: Principal;
  /**
   * Whether THIS session is untrusted by provenance (CLIENT-ASSIGNED TAINT).
   * Defaults to `true`. The model's output may only ESCALATE, never downgrade.
   */
  untrusted?: boolean;
  /** Human-in-the-loop gate. Defaults to deny-all (fail closed). */
  resolvePermission?: PermissionResolver;
  /** Optional single-shot prod-write escape supplier. */
  writeEscape?: WriteEscapeSupplier;
  /** Spawn override for tests (command/args). Defaults to the `claude` CLI. */
  command?: string;
  args?: string[];
  /**
   * Perform an allowed tool's side effect, inside the broker.execute context.
   * Defaults to a no-op (the deterministic test path only needs the gate + audit
   * proof). A real adapter would do the fs/shell/net work here — but the NATIVE
   * Claude path lets the `claude` CLI perform its own tool execution; this hook
   * exists for parity with AcpSession and for an explicit-perform deployment.
   */
  perform?: (call: AcpToolCall) => void;
  /**
   * Caveman terse mode (Phase 2). Default-ON (opt-out per session). Prepends the
   * vendored terse directive as system context to the prompt — shaping the
   * model's EXPLANATION only. Border surfaces never reach this injector, so they
   * structurally never carry it (AK-T3 Caveman-Negativ-Assert).
   */
  terse?: TerseConfig;
}

const DENY_ALL: PermissionResolver = () => ({ axis: "deny" });

export class ClaudeCodeProvider {
  readonly #broker: CapabilityBroker;
  readonly #store: SessionStore;
  readonly #principal: Principal;
  readonly #untrusted: boolean;
  readonly #resolve: PermissionResolver;
  readonly #writeEscape: WriteEscapeSupplier;
  readonly #perform: (call: AcpToolCall) => void;
  readonly #listeners = new Set<SessionListener>();
  #transport: ClaudeStreamTransport | null = null;
  #sessionId = "";
  #cwd: string;
  #model: string;
  #command?: string;
  #args?: string[];
  readonly #terse: TerseConfig;
  #sentSystemContext = "";

  constructor(opts: ClaudeCodeProviderOptions) {
    this.#broker = opts.broker;
    this.#store = opts.store;
    this.#cwd = opts.cwd;
    this.#model = opts.model ?? "Claude Code (native)";
    this.#principal =
      opts.principal ?? { id: "claude-code-native", kind: "agent", label: this.#model };
    this.#untrusted = opts.untrusted ?? true;
    this.#resolve = opts.resolvePermission ?? DENY_ALL;
    this.#writeEscape = opts.writeEscape ?? (() => undefined);
    this.#perform = opts.perform ?? (() => {});
    this.#command = opts.command;
    this.#args = opts.args;
    this.#terse = opts.terse ?? DEFAULT_TERSE_CONFIG;
  }

  /** The store session id (after `start`). */
  get sessionId(): string {
    return this.#sessionId;
  }

  /**
   * The exact system-context+prompt string sent to the model (Phase 2 assert
   * helper). Carries the terse directive marker when terse is on, not when off.
   */
  get sentSystemContext(): string {
    return this.#sentSystemContext;
  }

  /** Subscribe to this session's live event stream. */
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
   * Start the run: create the store record, spawn the sealed `claude` child,
   * write the prompt, and stream until the terminal `result`. Resolves the store
   * session id. Tool-call broker gating runs concurrently with the stream; the
   * run resolves only after the broker has finished gating every tool the model
   * requested before `done`.
   */
  async start(prompt: string): Promise<string> {
    const stored = await this.#store.create({
      model: this.#model,
      title: prompt,
      status: "running",
      worktreePath: this.#cwd,
    });
    this.#sessionId = stored.id;

    // Serialize broker gating so audit/store order is deterministic, and so a
    // slow human gate can't interleave two tool calls. Each parsed envelope's
    // tool calls are chained onto this tail; `done` waits for the tail.
    let gateTail: Promise<void> = Promise.resolve();

    const done = new Promise<void>((resolve) => {
      this.#transport = new ClaudeStreamTransport({
        command: this.#command,
        args: this.#args,
        cwd: this.#cwd,
        onEnvelope: (env: StreamJsonEnvelope) => {
          const parsed = parseStreamJsonEnvelope(env);
          // Emit + persist the non-tool SessionEvents in order.
          for (const event of parsed.events) {
            gateTail = gateTail.then(async () => {
              await this.#applyEvent(event);
              this.#emit(event);
            });
          }
          // Route every tool call through the broker (chained on the tail).
          for (const call of parsed.toolCalls) {
            gateTail = gateTail.then(() => this.#onToolCall(call));
          }
          if (parsed.done) {
            gateTail = gateTail.then(async () => {
              await this.#store.update(this.#sessionId, { status: "done" });
              this.#emit({ type: "done" });
              resolve();
            });
          }
        },
        onClose: () => {
          // If the child closed without a terminal `result`, finish the run on
          // the tail so subscribers still see `done` (degraded, never hangs).
          gateTail = gateTail.then(async () => {
            const current = await this.#store.get(this.#sessionId);
            if (current && current.status === "running") {
              await this.#store.update(this.#sessionId, { status: "done" });
              this.#emit({ type: "done" });
            }
            resolve();
          });
        },
      });
    });

    // CAVEMAN TERSE (Phase 2): prepend the vendored terse directive as system
    // context (default ON, opt-out per session). Shapes the model's EXPLANATION
    // only; the user/ToDo prompt below the marker is unchanged (still untrusted).
    // Border surfaces never pass through this injector → structurally bypass it.
    const sentPrompt = injectTerseDirective(prompt, this.#terse);
    this.#sentSystemContext = sentPrompt;
    this.#transport!.sendUserPrompt(sentPrompt);
    this.#transport!.endInput();

    await done;
    // Drain any tail work scheduled in the same microtask as `done`.
    await gateTail;
    return this.#sessionId;
  }

  /** Persist a non-tool SessionEvent into the store (status/telemetry). */
  async #applyEvent(event: SessionEvent): Promise<void> {
    switch (event.type) {
      case "status":
        await this.#store.update(this.#sessionId, { status: event.status });
        break;
      case "telemetry":
        await this.#store.update(this.#sessionId, { telemetry: event.telemetry });
        break;
      // token deltas stream to subscribers (the durable transcript assembly is
      // out of scope for the deterministic spine proof, mirroring AcpSession);
      // tool blocks are appended by `#onToolCall` only after the broker clears.
      case "token":
      case "tool":
      case "permission":
      case "done":
        break;
    }
  }

  /**
   * The BROKER SEAM. The model asked to run a tool; we answer ONLY through the
   * broker. No model-requested action runs without it. This is the byte-for-byte
   * analog of {@link AcpSession.#onAgentRequest} — same audit-before-execute,
   * same human-laundering path, same C3 single-use grant.
   */
  async #onToolCall(call: AcpToolCall): Promise<void> {
    // CLIENT-ASSIGNED TAINT: the session owns the taint (default untrusted). The
    // native stream-json protocol has no per-call `fromUntrusted` flag the model
    // controls — so the effective taint is purely the session's provenance, and
    // a model-derived egress in an untrusted session is forced through the gate.
    const effectiveUntrusted = this.#untrusted;
    const request: CapabilityRequest = {
      kind: call.kind,
      target: call.target,
      command: call.command,
      credentialRef: call.credentialRef,
      fromUntrusted: effectiveUntrusted,
    };

    // 1. Authorize AS THE AGENT (writes the append-only audit BEFORE execution).
    //    Untrusted egress is forced to `ask` here and can never auto-fire (the
    //    lethal-trifecta gate, MUST-NOT 4). On `allow` it mints the C3 grant.
    const decision = this.#broker.authorize(this.#principal, request);

    if (decision.outcome === "deny") {
      // Record the blocked tool in the transcript (honest: never silently drop).
      await this.#store.append(this.#sessionId, {
        type: "tool",
        block: { id: call.callId, kind: `${call.title} (blocked)`, target: call.target },
      });
      this.#emit({
        type: "tool",
        block: { id: call.callId, kind: `${call.title} (blocked)`, target: call.target },
      });
      return;
    }

    let execPrincipal = this.#principal;
    let execRequest = request;
    let execDecision: BrokerDecision = decision;

    // 2. On `ask`, the human gate decides (the only thing that clears it).
    if (decision.outcome === "ask") {
      const human = await this.#resolve(request, {
        fromUntrusted: effectiveUntrusted,
        principal: this.#principal,
        sessionId: this.#sessionId,
      });
      if (human.axis === "deny") {
        this.#broker.resolve(this.#principal, request, human);
        await this.#store.append(this.#sessionId, {
          type: "tool",
          block: { id: call.callId, kind: `${call.title} (blocked)`, target: call.target },
        });
        this.#emit({
          type: "tool",
          block: { id: call.callId, kind: `${call.title} (blocked)`, target: call.target },
        });
        return;
      }
      // The human reviewed THIS action and accepted responsibility — execution
      // proceeds as the human on the trusted request form (§3.3 laundering). The
      // agent's untrusted authorize stays in the audit as the gate record.
      const humanPrincipal: Principal = { id: "human", kind: "human", label: "You" };
      const trusted: CapabilityRequest = {
        kind: request.kind,
        target: request.target,
        command: request.command,
        credentialRef: request.credentialRef,
      };
      execPrincipal = humanPrincipal;
      execRequest = trusted;
      // Record the human grant against the ORIGINAL request (still carries
      // `fromUntrusted`) — the policy engine clamps an untrusted-derived egress
      // to a single-use grant (never persistable). Then mint the C3 execution
      // grant on the human's trusted request.
      this.#broker.resolve(humanPrincipal, request, human);
      execDecision = this.#broker.authorize(humanPrincipal, trusted);
      if (execDecision.outcome !== "allow") {
        await this.#store.append(this.#sessionId, {
          type: "tool",
          block: { id: call.callId, kind: `${call.title} (blocked)`, target: call.target },
        });
        this.#emit({
          type: "tool",
          block: { id: call.callId, kind: `${call.title} (blocked)`, target: call.target },
        });
        return;
      }
    }

    // 3. EXECUTE through the chokepoint (consumes the C3 grant, writes the
    //    `executed` audit, injects secrets only at the execution layer). The
    //    side effect runs inside this callback only. A forged "trusted" request
    //    has no grant and cannot run.
    try {
      this.#broker.execute(execPrincipal, execRequest, () => this.#perform(call), {
        writeEscape: this.#writeEscape(execRequest),
        grant: execDecision.grant,
      });
    } catch {
      await this.#store.append(this.#sessionId, {
        type: "tool",
        block: { id: call.callId, kind: `${call.title} (blocked)`, target: call.target },
      });
      this.#emit({
        type: "tool",
        block: { id: call.callId, kind: `${call.title} (blocked)`, target: call.target },
      });
      return;
    }

    // Cleared + executed — record the tool in the transcript.
    const block = { id: call.callId, kind: call.title, target: call.target };
    await this.#store.append(this.#sessionId, { type: "tool", block });
    this.#emit({ type: "tool", block });
  }

  /** Stop the run + tear down the child process. */
  close(): void {
    this.#transport?.close();
    this.#transport = null;
    this.#listeners.clear();
  }
}
