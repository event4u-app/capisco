/**
 * Data-shape contracts for the Agents workspace (concept §2.2, build-spec §4).
 * The UI builds against THESE; mock providers implement them, real ACP/session
 * providers will implement them later. Provider-output surfaces are not screen
 * features — see contracts/editor.ts.
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

export interface PermissionRequest {
  id: string;
  /** Capability in mono, e.g. `Bash(rm -rf .worktrees/tmp)`. */
  command: string;
  label: string;
  scopes: PermissionScope[];
  /** Secret-bearing capabilities show a reference, never a value (invariant §3.2). */
  credentialRef?: string;
}

export type MessageRole = "user" | "agent";

export interface Message {
  id: string;
  role: MessageRole;
  /** Optional display name override (e.g. "GPT-5", "Local"). */
  who?: string;
  body: string;
}

export interface SubAgent {
  id: string;
  model: ModelId;
  status: SessionStatus;
  title: string;
  /** Mono meta, e.g. "0m 31s · 1.2k ↓". Volatile — masked in golden captures. */
  meta: string;
}

/**
 * A diff line inside a collapsible ToolAction (added / removed / context).
 * Kept inline so the transcript stays self-describing without the editor.
 */
export interface ToolActionDiffLine {
  kind: "add" | "del" | "ctx";
  text: string;
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

export interface Session {
  id: string;
  model: ModelId;
  status: SessionStatus;
  title: string;
  meta: string;
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

export interface AgentProvider {
  listSessions(): Session[];
  /** Ordered transcript blocks (messages / tool actions / permission prompts). */
  getBlocks(sessionId: string): TranscriptBlock[];
  /** Legacy flat views over the same data (kept for compatibility). */
  getTranscript(sessionId: string): Message[];
  getToolActions(sessionId: string): ToolAction[];
  getPendingPermission(sessionId: string): PermissionRequest | null;
  getBackend(): BackendConfig;
  /** Models/agents offered in the new-session menu + composer model picker. */
  listAgents(): AgentOption[];
  /** Effort steps for the composer effort slider. */
  listEffortLevels(): EffortLevel[];
  /** Plan-usage rows for the budget-ring popover. */
  getPlanUsage(): PlanUsageRow[];
  /** Detected CLI backend (mock for the keychain/CLI-detect shell). */
  getDetectedCli(): BackendConfig;
}
