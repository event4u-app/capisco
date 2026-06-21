/**
 * Tooling contracts: Datasource (prod read-only invariant §3.3), Services
 * (ctop §4.8), and the shared signal surface (§5.2). build-spec §3.
 */

export interface DbTable {
  name: string;
}

export interface Datasource {
  name: string;
  engine: string;
  env: "local" | "staging" | "production";
  /** Production is read-only for ALL principals — invariant, not a toggle. */
  readonly?: boolean;
  /**
   * The credential is surfaced only as a reference name (invariant §2.1) —
   * never the secret value. UI shows e.g. `credential: staging-admin`.
   */
  credentialRef?: string;
  tables: string[];
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
  listSignals(): SignalItem[];
  /** The dumb routing rules (2-3). */
  listRules(): SignalRule[];
  /** Signals routed to one channel, honouring the enabled rules. */
  signalsFor(channel: "alerts" | "inspect"): SignalItem[];
}
