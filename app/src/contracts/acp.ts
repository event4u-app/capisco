/**
 * Agent Client Protocol (ACP) transport contract (B3 Phase 1, concept §4.1).
 *
 * "Empfehlung: ACP als Transport übernehmen, bevor irgendeine Agent-Anbindung
 * selbst gebaut wird." ACP is JSON-RPC over stdio (local) where the IDE mediates
 * file / terminal / tool access. The IDE is the *client*; the agent CLI (Claude
 * Code, Codex, Gemini …) is the *server* it spawns. We model the subset the
 * micro-north-star needs:
 *
 *  Client → Agent (requests, id-bearing):
 *    - `session/new`    → start a run; resolves a `sessionId`.
 *    - `session/prompt` → send the user/ToDo prompt into a run.
 *
 *  Agent → Client (requests the IDE must mediate — this is the broker seam):
 *    - `session/request_permission` → the agent asks to perform a tool/shell/
 *      file/net action. The IDE routes EVERY one through the capability broker
 *      (B4) and answers allow/deny. The agent CANNOT act around it — there is no
 *      direct fs/shell method on the client surface, only this gated request.
 *
 *  Agent → Client (notifications, id-less):
 *    - `session/update` → token deltas, tool-call records, status, telemetry.
 *
 * These map 1:1 onto the streaming surface in `contracts/agents.ts`
 * ({@link SessionEvent}) — the transport adapter (Phase 1) translates ACP
 * `session/update` notifications into `SessionEvent`s on the subscribe channel
 * and persists them into the {@link SessionStore}.
 *
 * DEFERRED: a real ACP agent CLI + LLM key is a thin swap — the same JSON-RPC
 * frames flow over the child process's stdio. The build tests against a
 * deterministic `stub-acp-agent.mjs` (scripted stdio), so CI never needs a real
 * agent or an API key.
 */

import type { CapabilityKind } from "./broker.ts";
import type { SessionEvent } from "./agents.ts";

/** The capability an ACP agent asks the client (IDE) to perform on its behalf. */
export interface AcpToolCall {
  /** Unique per-call id (for correlating the permission answer). */
  callId: string;
  /** What the agent wants to do — maps to a broker {@link CapabilityKind}. */
  kind: CapabilityKind;
  /** Concrete target — a command line, path, url, datasource. Never a secret. */
  target: string;
  /** Human-readable verb for the transcript (e.g. "Edit", "Run", "Read"). */
  title: string;
  /** For a db-write: the exact statement (matched against a WriteEscape). */
  command?: string;
  /** Reference name of a credential the action needs (never the value). */
  credentialRef?: string;
}

/**
 * A `session/request_permission` from the agent: it wants to perform
 * {@link AcpToolCall}. The IDE mediates this through the broker — `fromUntrusted`
 * marks calls derived from the agent's own (untrusted) reasoning over
 * web/ticket/file content (lethal trifecta §3.3). The CLIENT decides allow/deny;
 * the agent never executes directly.
 */
export interface AcpPermissionRequest {
  call: AcpToolCall;
  /** True when the call is derived from untrusted agent/web/ticket output. */
  fromUntrusted?: boolean;
}

/** The IDE's answer to a permission request (allow → the IDE runs it). */
export interface AcpPermissionResponse {
  /** `allow` → the client executes the call via the broker and returns its result. */
  outcome: "allow" | "deny";
  /** Why (audited). Never a secret value. */
  reason: string;
}

/**
 * One `session/update` notification from the agent — the ACP-shaped event the
 * transport translates into a {@link SessionEvent}. We carry the same union
 * payload so the mapping is total and lossless.
 */
export interface AcpSessionUpdate {
  sessionId: string;
  event: SessionEvent;
}

/**
 * Params for the client→agent `initialize` handshake (ACP spec, B8 P2b). The
 * real `@zed-industries/claude-code-acp` bridge — like any standard ACP agent —
 * REQUIRES an `initialize` exchange before `session/new`: the client announces
 * the protocol version it speaks and its own capabilities, and the agent replies
 * with the version it agreed on plus the agent capabilities it offers. The
 * deterministic stub does not require this (it is our own protocol half); the
 * handshake is opt-in via {@link AcpSessionOptions.handshake} so the stub path
 * stays byte-identical while the bridge path negotiates first.
 */
export interface AcpInitializeParams {
  /** The ACP protocol version the client (IDE) speaks. */
  protocolVersion: number;
  /** Client capabilities the agent may rely on (fs access is mediated by us). */
  clientCapabilities?: {
    /** The client mediates file-system reads/writes through the broker seam. */
    fs?: { readTextFile?: boolean; writeTextFile?: boolean };
  };
}

/** Result of the `initialize` handshake — the agent's agreed version + caps. */
export interface AcpInitializeResult {
  /** The protocol version the agent agreed to speak. */
  protocolVersion: number;
  /** Agent capabilities (e.g. whether it supports loading prior sessions). */
  agentCapabilities?: {
    loadSession?: boolean;
    promptCapabilities?: { image?: boolean; embeddedContext?: boolean };
  };
}

/** Params for the client→agent `session/new` request. */
export interface AcpNewSessionParams {
  /** The working directory (worktree) the run acts in (§2.1). */
  cwd: string;
  /** Model/agent label for the run. */
  model: string;
}

/** Params for the client→agent `session/prompt` request. */
export interface AcpPromptParams {
  sessionId: string;
  /** The user / ToDo prompt text. UNTRUSTED once it round-trips through the agent. */
  prompt: string;
}

/**
 * The ACP protocol version this client speaks. The bridge replies with the
 * version it agreed on; a mismatch the agent can't satisfy is a handshake error.
 */
export const ACP_PROTOCOL_VERSION = 1;

/** Reserved ACP method names (the wire vocabulary). */
export const ACP_METHODS = {
  /** client → agent (B8 P2b — required by the real bridge before session/new). */
  initialize: "initialize",
  /** client → agent. */
  newSession: "session/new",
  /** client → agent. */
  prompt: "session/prompt",
  /** agent → client (the broker seam). */
  requestPermission: "session/request_permission",
  /** agent → client (id-less notification). */
  update: "session/update",
} as const;
