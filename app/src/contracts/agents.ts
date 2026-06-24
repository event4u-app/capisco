/**
 * Data-shape contracts for the Agents workspace (concept §2.2, build-spec §4).
 * The UI builds against THESE; mock providers implement them, real ACP/session
 * providers will implement them later. Provider-output surfaces are not screen
 * features — see contracts/editor.ts.
 *
 * B-pre (Backend-Contracts): lifted from synchronous Snapshot-pull to
 * **async + streaming**. Every provider method returns a `Promise`; sessions
 * expose a **subscribe/event channel** (ACP-shaped token deltas / status
 * transitions / tool-call events) instead of being polled. `PermissionRequest`
 * gains a `resolve(decision)` return channel + grant axis. Telemetry is a
 * structured shape (`tokensIn/tokensOut/runtimeMs`) that aggregates
 * parent ← subagent, not a pre-rendered meta string. The session transcript is
 * a branching **tree** (retry branches, never overwrites — §2.2).
 */

export type SessionStatus = "running" | "idle" | "waiting" | "error" | "done";

/** Display label of a model/agent backend (e.g. "Opus 4.8", "GPT-5", "Local"). */
export type ModelId = string;

export interface ToolAction {
  id: string;
  /** Verb shown in the block (e.g. "Edit", "Search", "Read"). */
  kind: string;
  /** Mono target — a path or a query. */
  target: string;
  added?: number;
  removed?: number;
}

export type PermissionScope = string;

/**
 * Grant axis (§3) — the durability of a permission decision. `once` = this call
 * only; `session` = remainder of this session; `scoped` = a named capability
 * scope (e.g. read of one dir tree); `deny` = refused. There is deliberately NO
 * "permanent / always" value — a forever-grant must be structurally
 * unconstructable (security invariant §3.2).
 */
export type GrantAxis = "once" | "session" | "scoped" | "deny";

/** The decision a human returns through `PermissionRequest.resolve`. */
export interface PermissionDecision {
  axis: GrantAxis;
  /** Required when `axis === "scoped"` — the named scope the grant is bound to. */
  scope?: PermissionScope;
}

export interface PermissionRequest {
  id: string;
  /** Capability in mono, e.g. `Bash(rm -rf .worktrees/tmp)`. */
  command: string;
  label: string;
  scopes: PermissionScope[];
  /** Secret-bearing capabilities show a reference, never a value (invariant §3.2). */
  credentialRef?: string;
  /**
   * Whether this request is derived from UNTRUSTED agent/ticket/web/subagent
   * output (lethal-trifecta §3.3). When true the broker MUST gate it through a
   * hard human-in-the-loop prompt and may never auto-fire it. Untrusted output
   * is data, never instructions.
   */
  fromUntrusted?: boolean;
}

export type MessageRole = "user" | "agent";

/** A table / scorecard cell with an optional semantic tone (design-sync-v2 §3). */
export interface MessageCell {
  text: string;
  tone?: "ok" | "bad" | "warn";
}

/** A markdown-style table rendered in the transcript at full box width. */
export interface MessageTable {
  head: string[];
  rows: MessageCell[][];
  /** Optional footer row (scorecard totals). */
  foot?: MessageCell[];
  /** Scorecard styling: numeric columns right-aligned + mono. */
  scorecard?: boolean;
}

/** A stat-card (k / value / sub) in a 3-up grid below a message. */
export interface MessageCard {
  k: string;
  v: string;
  s?: string;
  tone?: "ok" | "bad";
}

export interface Message {
  id: string;
  role: MessageRole;
  /** Optional display name override (e.g. "GPT-5", "Local"). */
  who?: string;
  body: string;
  /** Optional rendered table (design-sync-v2 §3) — full box width. */
  table?: MessageTable;
  /** Optional stat-cards grid (design-sync-v2 §3). */
  cards?: MessageCard[];
}

/**
 * Structured run telemetry (§2 / Phase 1) — replaces the pre-rendered `meta`
 * string. `runtimeMs` is wall-clock; token counts are cumulative. The UI
 * renders this; goldens mask the volatile values. A node's `total()` rolls up
 * its own counters with every descendant subagent (parent ← subagent).
 */
export interface Telemetry {
  tokensIn: number;
  tokensOut: number;
  runtimeMs: number;
}

export interface SubAgent {
  id: string;
  model: ModelId;
  status: SessionStatus;
  title: string;
  /** Structured run telemetry (volatile — masked in golden captures). */
  telemetry: Telemetry;
}

/**
 * A diff line inside a collapsible ToolAction (added / removed / context).
 * Kept inline so the transcript stays self-describing without the editor.
 */
export interface ToolActionDiffLine {
  kind: "add" | "del" | "ctx";
  text: string;
  /** Optional gutter line number (design-sync-v2 §3 rich diff rows). */
  lineNo?: number;
}

/** A ToolAction that carries optional inline diff lines + open-in-editor target. */
export interface ToolActionBlock extends ToolAction {
  /** Inline diff preview rows; presence makes the block collapsible. */
  diff?: ToolActionDiffLine[];
  /** Editor target (file) when "open in editor" applies (search blocks omit it). */
  openTarget?: string;
}

/**
 * Ordered transcript content. A session's transcript is a flat, ordered list of
 * these blocks (build-spec §4 / agent.jsx Transcript) — the UI renders them in
 * order through the virtualized transcript.
 */
export type TranscriptBlock =
  | { type: "message"; block: Message }
  | { type: "tool"; block: ToolActionBlock }
  | { type: "permission"; block: PermissionRequest };

/**
 * A node in the session **tree** (§2.2). Retry branches: a `branch()` forks the
 * transcript at a point and writes a sibling node — it never overwrites the
 * parent. The active path is the chain from root to the selected leaf.
 */
export interface SessionNode {
  id: string;
  /** Parent node id, or null at the root. */
  parentId: string | null;
  /** The transcript block this node carries (the branch point's content). */
  block: TranscriptBlock;
  /** Child node ids in insertion order; multiple = a retry fork. */
  children: string[];
  /** Label for a retry branch (e.g. "retry 2 · GPT-5"); root path nodes omit it. */
  branchLabel?: string;
}

/** A whole session transcript as a tree (§2.2 retry-as-branch). */
export interface SessionTree {
  /** All nodes keyed by id. */
  nodes: Record<string, SessionNode>;
  /** Root node ids (ordered). */
  roots: string[];
  /** The currently-selected leaf — defines the active root→leaf path. */
  activeLeaf: string;
}

export interface Session {
  id: string;
  model: ModelId;
  status: SessionStatus;
  title: string;
  /** Structured run telemetry, aggregating subagents (volatile — masked in goldens). */
  telemetry: Telemetry;
  subs?: SubAgent[];
}

export type AgentBackendKind = "api" | "cli";

export interface BackendConfig {
  kind: AgentBackendKind;
  /** API: provider label; CLI: detected binary name. */
  provider: string;
  /** CLI only: detected path. API only: never the token value. */
  detail?: string;
}

/** A model/agent that can back a new session (composer + new-session menu). */
export interface AgentOption {
  id: ModelId;
  label: string;
}

/** Effort level for the composer effort slider (Faster ↔ Smarter). */
export interface EffortLevel {
  id: number;
  label: string;
}

/** One plan-usage row in the budget popover (label · right-hand value · pct). */
export interface PlanUsageRow {
  id: string;
  label: string;
  /** Right-hand mono value, e.g. "resets Jun 19 · 93%". Volatile — masked in goldens. */
  detail: string;
  pct: number;
  /** Token-driven bar tone. */
  tone: "accent" | "warning" | "tertiary";
}

/**
 * An event on a session's stream (ACP-shaped). Mock providers emit a
 * deterministic sequence; real ACP transports forward the agent's stdio frames.
 *  - `token`   — an incremental message-body delta for `messageId`.
 *  - `status`  — a session status transition.
 *  - `tool`    — a tool-call block was appended.
 *  - `permission` — a permission request was raised (gate, never auto-fired).
 *  - `telemetry`  — updated structured run telemetry.
 *  - `done`    — the stream completed (no further events).
 */
export type SessionEvent =
  | { type: "token"; messageId: string; delta: string }
  | { type: "status"; status: SessionStatus }
  | { type: "tool"; block: ToolActionBlock }
  | { type: "permission"; request: PermissionRequest }
  | { type: "telemetry"; telemetry: Telemetry }
  | { type: "done" };

/** Listener for the session event channel. */
export type SessionListener = (event: SessionEvent) => void;

/** Unsubscribe handle returned by `subscribe`. */
export type Unsubscribe = () => void;

/**
 * Async + streaming agent provider (B-pre). Every read is a `Promise`; the live
 * session surface (token deltas / status / tool-calls / permissions) is pushed
 * through `subscribe`, never polled.
 */
export interface AgentProvider {
  listSessions(): Promise<Session[]>;
  /** Ordered transcript blocks (messages / tool actions / permission prompts). */
  getBlocks(sessionId: string): Promise<TranscriptBlock[]>;
  /** The session transcript as a branching tree (§2.2 retry-as-branch). */
  getTree(sessionId: string): Promise<SessionTree>;
  /**
   * Fork the transcript at `nodeId` and append a sibling retry branch (never
   * overwrites). Resolves to the new leaf node id (the active path's tip).
   */
  branch(sessionId: string, nodeId: string, label?: string): Promise<string>;
  /** Legacy flat views over the same data (kept for compatibility). */
  getTranscript(sessionId: string): Promise<Message[]>;
  getToolActions(sessionId: string): Promise<ToolAction[]>;
  getPendingPermission(sessionId: string): Promise<PermissionRequest | null>;
  /**
   * Resolve a pending permission with a human decision (§3 return channel). The
   * broker persists the grant per its axis; resolves to the persisted axis the
   * broker recorded (a `deny` or an unconstructable forever-grant collapses to
   * a safe value).
   */
  resolvePermission(
    sessionId: string,
    requestId: string,
    decision: PermissionDecision,
  ): Promise<GrantAxis>;
  /**
   * Subscribe to a session's live event stream (ACP-shaped). Returns an
   * unsubscribe handle. Mock emits a deterministic sequence; nothing is polled.
   */
  subscribe(sessionId: string, listener: SessionListener): Unsubscribe;
  getBackend(): Promise<BackendConfig>;
  /** Models/agents offered in the new-session menu + composer model picker. */
  listAgents(): Promise<AgentOption[]>;
  /** Effort steps for the composer effort slider. */
  listEffortLevels(): Promise<EffortLevel[]>;
  /** Plan-usage rows for the budget-ring popover. */
  getPlanUsage(): Promise<PlanUsageRow[]>;
  /** Detected CLI backend (mock for the keychain/CLI-detect shell). */
  getDetectedCli(): Promise<BackendConfig>;
  /**
   * Live size of the assembled system context — the SAME loaded rules /
   * guidelines sent with a turn (composer-context-runtime P5). The composer's
   * rules-warning flips at the real `limit`, not a hardcoded value.
   */
  getSystemContextSize(): Promise<SystemContextSize>;
  /**
   * Send a user turn into an existing session and drive a live agent run
   * (road-to-agent-backend-enablement P2). Appends the user message, runs the
   * agent (broker-gated, human-gated), and streams its reply/tool blocks into
   * the session — observed via {@link subscribe} / {@link getBlocks}. Resolves
   * when the turn is dispatched (the stream completes asynchronously). The mock
   * is a no-op (the browser has no live agent); the live provider drives the ACP
   * session.
   */
  sendPrompt(sessionId: string, text: string): Promise<void>;
}

/** Live system-context size — the loaded rules/guidelines char count + limit. */
export interface SystemContextSize {
  /** Total characters of the assembled system context (== what is sent). */
  chars: number;
  /** The character budget; the rules-warning flips when `chars > limit`. */
  limit: number;
}
