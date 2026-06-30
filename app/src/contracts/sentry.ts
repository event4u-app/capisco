/**
 * Sentry provider contract (road-to-real-breadth P3 / SENTRY-BACKEND-SPEC §3).
 * The issues core: real errors surfaced in the IDE + fed onto the shared signal
 * rail. Crons / performance / alert-rules are follow-on slices (spec §4.2–4.4) —
 * this is the verifiable backbone. Every value is JSON-safe, non-secret.
 */

import type { SignalItem } from "./tooling";

export type SentryLevel = "error" | "warning" | "info";
export type SentryStatus = "unresolved" | "ignored" | "resolved";
export type SentryCronStatus = "ok" | "failing" | "timeout";

/** One Sentry issue (SENTRY-BACKEND-SPEC §3 Issue shape). */
export interface SentryIssue {
  /** `shortId`, e.g. `CAP-4F2`. */
  id: string;
  level: SentryLevel;
  title: string;
  culprit: string;
  project: string;
  env: string;
  events: number;
  users: number;
  /** Relative age from `firstSeen`, e.g. "2d". */
  age: string;
  /** Relative last-seen, e.g. "5m". */
  lastSeen: string;
  status: SentryStatus;
  /** 24h event buckets (sparkline). */
  trend: number[];
  assignee: string | null;
}

/** One Cron Monitor (SENTRY-BACKEND-SPEC §3 Cron shape). */
export interface SentryCron {
  name: string;
  /** Human-readable schedule, e.g. "Every 15 min". */
  schedule: string;
  project: string;
  /** Aggregated from the most recent check-ins. */
  status: SentryCronStatus;
  /** Relative last check-in, e.g. "4d ago". */
  lastSeen: string;
  /** Last N check-ins as `s`(ok) / `f`(fail) / `t`(timeout). */
  ticks: string;
  /** Count of linked alert rules. */
  alerts: number;
}

/** Workspace stats header (SENTRY-BACKEND-SPEC §3 Stats shape). */
export interface SentryStats {
  errors24h: number;
  /** Trend string, e.g. "+18%". */
  errorsTrend: string;
  /** Crash-free sessions, e.g. "99.82%". */
  crashFree: string;
  failingCrons: number;
  /** p95 transaction duration, e.g. "842 ms". */
  p95: string;
  /** Apdex score, 0–1. */
  apdex: number;
}

/** One alert rule (SENTRY-BACKEND-SPEC §3 Alert shape). */
export interface SentryAlertRule {
  name: string;
  /** Condition, e.g. "errors > 50 in 1h". */
  cond: string;
  /** Delivery channel, e.g. "IDE + Slack #alerts". */
  channel: string;
  on: boolean;
  level: SentryLevel;
}

export interface SentryProvider {
  /** The configured organization slug. */
  readonly org: string;
  /** Issues for the org (default `is:unresolved`), optionally scoped to a project/env. */
  listIssues(opts?: { query?: string; project?: string }): Promise<SentryIssue[]>;
  /** Project Sentry issues onto the shared signal rail (source `observability`). */
  toSignals(issues: SentryIssue[]): SignalItem[];
}

/**
 * Full read surface for the four-tab Sentry workspace (issues + crons +
 * performance stats + alert rules). The fixture provider implements this for
 * the autonomous P0 slice; the real provider grows into it across P1/P3. Writes
 * (resolve/ignore/assign/toggle) are NOT here — they flow through the broker
 * (roadmap P2), never the read provider.
 */
export interface SentryReadProvider extends SentryProvider {
  listCrons(): Promise<SentryCron[]>;
  getStats(): Promise<SentryStats>;
  listAlertRules(): Promise<SentryAlertRule[]>;
}
