/**
 * Capability-Broker contracts (B4, concept §3 / overview §3 Security-Invarianten).
 *
 * The broker is the **un-bypassable execution chokepoint**: NO agent capability
 * exists except through it. It mediates `(Principal × Capability × Scope) →
 * Decision`, owns the secret vault (capability-by-reference — secrets are NEVER
 * a value in the LLM context / session store / log, only a `credentialRef`),
 * writes an append-only audit BEFORE execution, enforces the production
 * read-only invariant (derived, not settable), and hard-gates egress derived
 * from untrusted agent/ticket/web output (lethal trifecta).
 *
 * Every type here is a security surface. The shapes are deliberately narrow so
 * the dangerous states (permanent prod-write, secret-as-value, auto-fired
 * untrusted egress) are *structurally unconstructable*, not merely defended
 * against at runtime.
 */

import type {
  GrantAxis,
  PermissionDecision,
  PermissionRequest,
  Unsubscribe,
} from "./agents.ts";
import type { WriteEscape } from "./tooling.ts";

/**
 * Any actor the broker mediates — human OR agent. The human is NOT a privileged
 * bypass (§3.1): a sensitive command runs the same gate regardless of who
 * triggers it. `trust` records whether this principal's *output* is trusted as
 * instructions: an `agent` principal's output is untrusted DATA (lethal
 * trifecta), a `human` principal's direct request is trusted intent.
 */
export interface Principal {
  id: string;
  kind: "human" | "agent";
  /** Display label (e.g. "You", "Opus 4.8 · sess-3"). Never a secret. */
  label: string;
}

/**
 * The kind of capability being requested. These are the only execution edges
 * that exist — shell, file, network, db, secret-read, secret-write, and the
 * external write-back (ticket status, browser action). Nothing executes outside
 * one of these mediated kinds.
 */
export type CapabilityKind =
  | "shell"
  | "file-read"
  | "file-write"
  | "network"
  | "db-read"
  | "db-write"
  | "secret-read"
  | "external-write"
  // Cross-project session-knowledge read (road-to-cross-project-knowledge P2,
  // AK-C4). A NEW scope axis: reading another project's session store across the
  // project boundary. It is NOT an implicit allow — it is fail-closed (no
  // default allowlist rule → `ask`) and never in the default allowlist. The
  // bridge carries conversation/knowledge context only, NEVER executable
  // cross-project access (AK-C6 — that would be a separate, later capability).
  | "cross-project-read";

/**
 * A capability request presented to the broker. `target` is the concrete object
 * (a command line, path, url, datasource, credentialRef target). It is matched
 * against the allowlist patterns.
 *
 * `fromUntrusted` marks output that ORIGINATED from an untrusted source
 * (agent/ticket/web/subagent) — when a write/network/db-write/external-write
 * capability is derived from such output, the broker MUST raise a hard
 * `PermissionRequest` and may never auto-grant it (lethal-trifecta §3.3).
 *
 * `credentialRef` is the only way a capability references a secret. It is a
 * NAME, never a value — the value is injected at the execution layer, never
 * exposed to the requester. A `value` field does not exist on this type.
 */
export interface CapabilityRequest {
  kind: CapabilityKind;
  /** The concrete target — a command, path, url, datasource name. Never a secret. */
  target: string;
  /**
   * For a `db-write` against a production datasource: the exact statement the
   * single-shot {@link WriteEscape} must authorise. The escape's `command` is
   * matched against this. Absent for non-db-write capabilities.
   */
  command?: string;
  /** Reference name of a credential this capability needs (never the value). */
  credentialRef?: string;
  /** True when this capability is derived from untrusted agent/ticket/web output. */
  fromUntrusted?: boolean;
  /**
   * Issuing task id (scoped-grant v2.2 F2). Binds an {@link ExecutionGrant} to
   * the task that authorised it — a grant minted under one task can never be
   * executed by a request carrying a different `taskId` (the fingerprint
   * includes it). Optional; absent on non-task-scoped calls (fingerprinted as
   * `""`, so existing behaviour is unchanged).
   */
  taskId?: string;
  /**
   * Absolute, realpath-canonicalised target (scoped-grant v2.2 F1). Populated by
   * the caller that knows the repo root (e.g. `fs-write-broker`) so a scoped
   * grant's path check can compare against an absolute `pathPrefix`. `target`
   * stays the relative audit-label / allowlist-match input; this field is
   * additive and read only by the scoped-grant path.
   */
  canonicalTarget?: string;
}

/** A named scope a grant can be bound to (e.g. a dir tree, a datasource). */
export type CapabilityScope = string;

/**
 * The broker's verdict for one `(Principal × Capability × Scope)`. Either it is
 * `allow`ed outright (matched a conservative allowlist grant), `deny`ed
 * outright (matched a deny rule or violates an invariant), or it requires a
 * human decision through a `PermissionRequest` (`ask`). There is deliberately
 * no `allow-forever` outcome — durability lives on the {@link GrantAxis}, which
 * has no permanent value.
 */
export type BrokerOutcome = "allow" | "deny" | "ask";

/**
 * A single-use execution grant (C3) — an opaque, broker-minted handle that binds
 * an `allow` decision to the EXACT (principal × request) it was issued for.
 *
 * `authorize` mints one only when its decision is `allow`; `execute` REQUIRES a
 * matching, unconsumed handle and consumes it. A caller cannot fabricate a
 * "trusted" execution: there is no public constructor, the `id` is opaque, and
 * `execute` verifies the handle against its own private registry of issued
 * (unconsumed) grants — a forged or mismatched handle is rejected. This makes
 * "call execute() with a hand-rolled allow request" structurally unconstructable;
 * every execution edge traces back to a prior, audited `authorize`.
 */
export interface ExecutionGrant {
  /** Opaque, broker-minted, single-use token. Never a secret; not caller-forgeable. */
  readonly id: string;
}

export interface BrokerDecision {
  outcome: BrokerOutcome;
  /** When `outcome === "ask"`, the request a human must resolve. */
  request?: PermissionRequest;
  /** Human-readable reason (audited). Never contains a secret value. */
  reason: string;
  /**
   * When `outcome === "allow"`, the single-use {@link ExecutionGrant} that
   * `execute` requires to run THIS exact (principal × request). Absent for
   * `ask`/`deny` — there is nothing to execute. (C3 authorize↔execute binding.)
   */
  grant?: ExecutionGrant;
}

/**
 * One conservative, human-authored allowlist rule. The DEFAULT allowlist is
 * intentionally narrow (read-only / status commands `allow`, everything
 * mutating `ask`); the build NEVER invents a permissive default. Patterns are
 * matched against `CapabilityRequest.target`.
 *
 * A rule may only resolve to `allow`, `deny`, or `ask` — there is NO
 * "permanent" verdict here. Persistent durability is a separate human decision
 * recorded on the grant axis, and even that has no forever value.
 */
export interface AllowlistRule {
  kind: CapabilityKind;
  /**
   * Glob-ish pattern matched against the target, e.g. `git status*`, `git
   * commit*`, `rm*`. A `*` matches any suffix. Exact otherwise.
   */
  pattern: string;
  /** What the broker does on a match — never "allow-forever". */
  verdict: "allow" | "deny" | "ask";
}

/**
 * The conservative default grant configuration (§4 human-gated). This is
 * CONFIG, not code — the broker reads it, it is not hard-coded into the policy
 * logic. The shipped default is deliberately minimal; a deployment may extend
 * it (human-authored), but the build never widens it autonomously.
 */
export interface GrantConfig {
  rules: AllowlistRule[];
}

/**
 * The policy engine: `(Principal × Capability × Scope) → BrokerDecision`. Pure
 * decision logic over the grant config + persisted per-project grants. It does
 * NOT execute anything and never sees secret values.
 */
export interface PolicyEngine {
  /**
   * Decide a capability request. `scope` narrows a `scoped` grant lookup.
   * Untrusted egress (`fromUntrusted` + a write/network kind) can never resolve
   * to `allow` here — it is forced to `ask` regardless of the allowlist.
   */
  decide(
    principal: Principal,
    request: CapabilityRequest,
    scope?: CapabilityScope,
  ): BrokerDecision;
  /**
   * Record a human's resolution of an `ask` (the §3 return channel). `once` is
   * single-shot (not persisted); `session`/`scoped` persist per project; `deny`
   * is remembered. Returns the axis the engine actually recorded. There is no
   * path to record a forever-grant — {@link GrantAxis} has no such value.
   */
  resolve(
    principal: Principal,
    request: CapabilityRequest,
    decision: PermissionDecision,
    scope?: CapabilityScope,
  ): GrantAxis;
}

/**
 * The secret vault (§3.2, capability-by-reference). The store maps a reference
 * NAME to a secret value, but the value is ONLY ever returned by
 * {@link inject}, which the broker calls at the execution layer. There is no
 * method that returns a value to the caller for placement in a prompt / env /
 * CLI-arg. `list` returns reference names only.
 */
export interface SecretStore {
  /** Store/replace a secret under a reference name. The value never leaves again as a value. */
  put(ref: string, value: string): void;
  /** Reference names only — NEVER values. Safe to log / show. */
  list(): string[];
  /** Whether a reference exists. No value disclosure. */
  has(ref: string): boolean;
  /**
   * Execution-layer injection (§3.2): the ONLY path a secret value is used. The
   * broker passes a `use` callback that receives the value and performs the
   * privileged action (HTTP header, DB driver auth) — the value is scoped to
   * that callback and never returned to the caller. This makes
   * "read the secret into a variable I control" unconstructable.
   */
  inject<T>(ref: string, use: (value: string) => T): T;
}

/**
 * One append-only audit entry, written BEFORE execution (§3.4 / §4 invariant).
 * Records the actor + capability + credentialRef — NEVER the secret value.
 */
export interface AuditEntry {
  /** Monotonic sequence (append-only ordering — not wall-clock, deterministic). */
  seq: number;
  principalId: string;
  principalKind: Principal["kind"];
  capability: CapabilityKind;
  target: string;
  /** Reference name only — never a value. */
  credentialRef?: string;
  outcome: BrokerOutcome | "executed" | "vault-write-proposed";
  fromUntrusted: boolean;
  reason: string;
}

/**
 * Append-only audit store. `record` appends; there is no update/delete — the
 * shape has no mutation method, so tampering is structurally impossible. The
 * broker writes BEFORE it executes.
 */
export interface AuditStore {
  record(entry: Omit<AuditEntry, "seq">): AuditEntry;
  list(): readonly AuditEntry[];
  /**
   * Subscribe to live appends — the listener fires once per `record`, in `seq`
   * order, with the SAME frozen entry `list` returns (credentialRef names only,
   * never a value). Because the broker records every decision
   * (authorize allow/deny/gate · execute · vault-write-proposed) BEFORE it acts,
   * this append stream IS the live broker-decision stream the observability
   * surface consumes (out-of-band, like `RuntimeProvider.subscribeStats`).
   * Returns an unsubscribe handle. An observer MUST NOT call `record` (it would
   * re-enter); a throwing observer is isolated and never breaks the append or
   * the broker.
   */
  subscribe(listener: (entry: AuditEntry) => void): Unsubscribe;
}

/**
 * A bidirectional vault write-back PROPOSAL (§3.2): when an agent creates e.g. a
 * test user, the broker proposes writing the new credential into the vault —
 * with human approval, NEVER straight into the chat. The proposal carries the
 * reference name and a one-time handle; the value is supplied out-of-band on
 * approval, never echoed.
 */
export interface VaultWriteProposal {
  ref: string;
  /** Why the write is proposed (audited). Never the value. */
  reason: string;
  approved: boolean;
}

/**
 * The capability broker — the single execution chokepoint. Everything an agent
 * (or human) does that touches shell/file/network/db/secret flows through
 * `authorize` then `execute`. No provider exposes an execution edge that
 * bypasses it.
 */
export interface CapabilityBroker {
  /**
   * Run the policy engine, write the audit entry, and return the decision. This
   * is pure authorization — it does NOT execute. An `ask` outcome carries the
   * `PermissionRequest` the UI must resolve; an `allow` outcome carries a
   * single-use {@link ExecutionGrant} that `execute` requires (C3 binding).
   */
  authorize(
    principal: Principal,
    request: CapabilityRequest,
    scope?: CapabilityScope,
  ): BrokerDecision;
  /**
   * Resolve a pending `ask` with a human decision (§3 return channel). Returns
   * the recorded {@link GrantAxis}.
   */
  resolve(
    principal: Principal,
    request: CapabilityRequest,
    decision: PermissionDecision,
    scope?: CapabilityScope,
  ): GrantAxis;
  /**
   * Execute an authorized capability. REQUIRES the single-use
   * {@link ExecutionGrant} that a prior `authorize` minted for THIS exact
   * (principal × request) — `execute` is not an independent re-decide, so a
   * caller cannot bypass the gate by handing `execute` a forged "trusted"
   * request (C3). A missing, mismatched, or already-consumed grant throws
   * `capability not authorized`; the grant is consumed on success. Secrets are
   * injected here at the execution layer via {@link SecretStore.inject} — the
   * `run` callback receives an injector, never a raw value. The audit
   * `executed` entry is written before the callback runs.
   *
   * Production datasource writes require a fresh single-shot {@link WriteEscape}
   * (§3.3); a missing/consumed escape makes the write unconstructable.
   */
  execute<T>(
    principal: Principal,
    request: CapabilityRequest,
    run: (ctx: ExecutionContext) => T,
    options?: { scope?: CapabilityScope; writeEscape?: WriteEscape; grant?: ExecutionGrant },
  ): T;
  /** Propose a bidirectional vault write-back (§3.2), human-gated. */
  proposeVaultWrite(ref: string, reason: string): VaultWriteProposal;
  /** Approve a proposal and commit the value to the vault (never via chat). */
  commitVaultWrite(proposal: VaultWriteProposal, value: string): void;
  readonly audit: AuditStore;
  readonly secrets: SecretStore;
}

/**
 * What an {@link CapabilityBroker.execute} callback receives. The ONLY way to
 * use a secret is `withSecret`, which scopes the value to the callback (the
 * execution-layer injection point). There is no `getSecret(): string` — a
 * leak-into-a-variable path does not exist.
 */
export interface ExecutionContext {
  /** Execution-layer secret injection. The value never escapes the callback. */
  withSecret<T>(ref: string, use: (value: string) => T): T;
}
