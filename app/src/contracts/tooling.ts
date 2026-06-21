/**
 * Tooling contracts: Datasource (prod read-only invariant §3.3), Services
 * (ctop §4.8), and the shared signal surface (§5.2). build-spec §3.
 */

export interface DbTable {
  name: string;
}

export type DatasourceEnv = "local" | "staging" | "production";

/**
 * The raw fields a datasource is declared with. `readonly` is deliberately
 * ABSENT — it is a derived invariant computed from `env`, never declared and
 * never settable (security invariant §3.3).
 */
export interface DatasourceInput {
  name: string;
  engine: string;
  env: DatasourceEnv;
  /**
   * The credential is surfaced only as a reference name (invariant §2.1) —
   * never the secret value. UI shows e.g. `credential: staging-admin`.
   */
  credentialRef?: string;
  tables: string[];
}

/**
 * A datasource as the app sees it. `readonly` is a **derived, non-settable
 * invariant**: `readonly === (env === "production")`. The field is `readonly`
 * in the TS sense (the compiler rejects assignment) and the runtime object is
 * frozen, so a "permanently allow prod write" path is structurally
 * unconstructable (invariant §3.3). Use {@link makeDatasource} to build one —
 * the constructor is the only place the invariant is established.
 */
export interface Datasource extends DatasourceInput {
  /**
   * Production is read-only for ALL principals — a derived fact, NOT a toggle.
   * Always present; equals `env === "production"`.
   */
  readonly readonly: boolean;
}

/**
 * The single constructor for a {@link Datasource}. Derives the `readonly`
 * invariant from `env` and freezes the object so neither the field nor the
 * invariant can be reassigned. Passing a `readonly` field on the input is a
 * type error (it is not part of `DatasourceInput`).
 */
export function makeDatasource(input: DatasourceInput): Datasource {
  return Object.freeze({
    ...input,
    readonly: input.env === "production",
  });
}

/**
 * A per-command, single-shot write escape (invariant §3.3). It authorises ONE
 * write against a read-only (production) datasource and auto-reverts. There is
 * no session-wide or "remember" form — that shape is intentionally not
 * expressible here.
 *
 * S3 hardening: the escape is FROZEN at construction and carries an opaque,
 * one-time `id`. Consumption is tracked by the broker in a used-escape registry
 * keyed on `id` — NOT by a mutable `consumed` flag the supplier could reset or
 * re-mint. So neither "reset `consumed` and replay" nor "mint a fresh escape per
 * call for the same prod write" works: the broker records the id on first use
 * and refuses any later write riding the same id, and the frozen object makes
 * the legacy `consumed` field non-writable for back-compat readers.
 */
export interface WriteEscape {
  /** Opaque, one-time id — the broker tracks consumption by this, not by a flag. */
  readonly id: string;
  /** The datasource the single write is authorised against. */
  readonly datasource: string;
  /** The exact command the escape authorises (audited before execution §3.4). */
  readonly command: string;
  /**
   * Legacy read-only view of spent-state. Frozen — a holder cannot reset it.
   * The broker's used-escape registry (keyed on `id`) is the authority; this
   * flag is a back-compat mirror set on the frozen object at mint time (`false`).
   */
  readonly consumed: boolean;
}

let writeEscapeSeq = 0;

/**
 * Issues a fresh, unconsumed single-shot write escape for one command. The
 * returned object is FROZEN (S3): its `consumed` flag cannot be reset and a
 * caller cannot widen its shape. The unique `id` lets the broker register the
 * escape as spent on first use so a re-minted clone for the same prod write is
 * still refused.
 */
export function makeWriteEscape(datasource: string, command: string): WriteEscape {
  return Object.freeze({
    id: `we-${++writeEscapeSeq}`,
    datasource,
    command,
    consumed: false,
  });
}

export type ContainerStatus = "running" | "exited" | "error";

export interface ServiceStat {
  name: string;
  image: string;
  status: ContainerStatus;
  cpu: number;
  mem: string;
  memPct: number;
  ports: string;
  uptime: string;
}

export interface ContainerGroup {
  project: string;
  services: ServiceStat[];
}

export type SignalSeverity = "waiting" | "success" | "warning" | "idle";

/** Where a signal originated — the shared rail (§5.2) folds PR / container /
 * observability sources into one `SignalItem` shape. */
export type SignalSource = "pr" | "container" | "observability" | "agent" | "lint";

/** One notification on the shared signal surface (PR / container / observability). */
export interface SignalItem {
  id: string;
  sev: SignalSeverity;
  source: SignalSource;
  title: string;
  sub: string;
}

/** A deliberately dumb routing rule for the shared signal surface (§5.2 — the
 * rule side is intentionally minimal: 2-3 rules, not a rules engine). */
export interface SignalRule {
  id: string;
  /** Sources this rule routes. */
  source: SignalSource;
  /** Where matching signals land. */
  channel: "alerts" | "inspect";
  enabled: boolean;
}

/** The shared signal surface (§5.2): one notification rail feeding both
 * Alerts and Inspect via a small set of routing rules. */
export interface SignalProvider {
  /** Every signal on the shared rail, source-tagged. */
  listSignals(): Promise<SignalItem[]>;
  /** The dumb routing rules (2-3). */
  listRules(): Promise<SignalRule[]>;
  /** Signals routed to one channel, honouring the enabled rules. */
  signalsFor(channel: "alerts" | "inspect"): Promise<SignalItem[]>;
}
