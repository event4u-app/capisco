import type {
  ContainerGroup,
  Datasource,
  SignalItem,
  SignalProvider,
  SignalRule,
} from "@/contracts";

/**
 * Deterministic tooling providers (build-spec §3, prototype shared.jsx
 * DATASOURCES / CONTAINER_GROUPS / ALERTS / INSPECTIONS). Implements the R0
 * data-shape interfaces; no Date.now / Math.random anywhere.
 *
 * Invariants surfaced as UI facts (Overview §2):
 *  - `production` datasources are read-only for ALL principals — `readonly`
 *    flag, never a toggle.
 *  - Secrets never appear as values — `credentialRef` is a reference name only.
 */

/** Datasources grouped by connection (prototype DATASOURCES). `prod` is
 * read-only (invariant) and exposes only a credential *reference*. */
export const mockDatasources: Datasource[] = [
  {
    name: "local",
    engine: "postgres",
    env: "local",
    credentialRef: "local-dev",
    tables: ["users", "sessions", "grants", "worktrees"],
  },
  {
    name: "staging",
    engine: "postgres",
    env: "staging",
    credentialRef: "staging-admin",
    tables: ["users", "sessions", "grants"],
  },
  {
    name: "prod",
    engine: "postgres",
    env: "production",
    readonly: true,
    credentialRef: "prod-readonly",
    tables: ["users", "sessions", "grants", "audit_log"],
  },
  {
    name: "cache",
    engine: "redis",
    env: "local",
    credentialRef: "local-dev",
    tables: ["keys"],
  },
];

/** Containers grouped by loaded project (ctop-style, prototype CONTAINER_GROUPS). */
export const mockContainerGroups: ContainerGroup[] = [
  {
    project: "capisco-core",
    services: [
      { name: "web", image: "node:22", status: "running", cpu: 34, mem: "412 MB", memPct: 41, ports: "5173→5173", uptime: "2h 14m" },
      { name: "postgres", image: "postgres:16", status: "running", cpu: 2, mem: "96 MB", memPct: 10, ports: "5432→5432", uptime: "3d" },
      { name: "traefik", image: "traefik:v3", status: "running", cpu: 1, mem: "48 MB", memPct: 5, ports: "80, 443", uptime: "3d" },
      { name: "playwright", image: "playwright:1.49", status: "exited", cpu: 0, mem: "0 MB", memPct: 0, ports: "—", uptime: "—" },
    ],
  },
  {
    project: "capisco-tauri",
    services: [
      { name: "tauri-build", image: "rust:1.81", status: "running", cpu: 8, mem: "128 MB", memPct: 13, ports: "—", uptime: "2h 14m" },
      { name: "redis", image: "redis:7", status: "running", cpu: 1, mem: "24 MB", memPct: 3, ports: "6379→6379", uptime: "2h 14m" },
    ],
  },
];

/**
 * The shared signal surface (§5.2): ONE notification rail, source-tagged, that
 * folds PR / container / observability / agent / lint events into a single
 * `SignalItem` shape. Alerts and Inspect are just two *views* of this rail,
 * routed by a deliberately dumb rule set (2-3 rules), not a rules engine.
 */
const SIGNALS: SignalItem[] = [
  { id: "sig-1", source: "agent", sev: "waiting", title: "Local session needs approval", sub: "Bash(rm -rf .worktrees/tmp)" },
  { id: "sig-2", source: "container", sev: "success", title: "3 tests passed", sub: "core/broker.test.ts · 312ms" },
  { id: "sig-3", source: "pr", sev: "warning", title: "Review requested on #1283", sub: "Capability scope cache · mara" },
  { id: "sig-4", source: "observability", sev: "warning", title: "web container CPU 34%", sub: "capisco-core · node:22" },
  { id: "sig-5", source: "agent", sev: "idle", title: "GPT-5 session idle 4m", sub: "Refactor broker grant model" },
  { id: "sig-6", source: "lint", sev: "warning", title: "broker.ts — 1 weak warning", sub: "Prefer const over let · Ln 18" },
  { id: "sig-7", source: "lint", sev: "success", title: "worktree.ts — clean", sub: "No problems found" },
  { id: "sig-8", source: "lint", sev: "idle", title: "Typecheck", sub: "tsc --noEmit · passing" },
];

/** The dumb routing rules — operational events to Alerts, code-quality to
 * Inspect. Intentionally tiny (§5.2 "Regel-Seite bewusst dumm"). */
const RULES: SignalRule[] = [
  { id: "rule-ops", source: "agent", channel: "alerts", enabled: true },
  { id: "rule-pr", source: "pr", channel: "alerts", enabled: true },
  { id: "rule-container", source: "container", channel: "alerts", enabled: true },
  { id: "rule-obs", source: "observability", channel: "alerts", enabled: true },
  { id: "rule-lint", source: "lint", channel: "inspect", enabled: true },
];

export const mockSignalProvider: SignalProvider = {
  listSignals: () => SIGNALS,
  listRules: () => RULES,
  signalsFor: (channel) => {
    const sources = new Set(RULES.filter((r) => r.enabled && r.channel === channel).map((r) => r.source));
    return SIGNALS.filter((s) => sources.has(s.source));
  },
};
