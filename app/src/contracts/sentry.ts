/**
 * Sentry provider contract (road-to-real-breadth P3 / SENTRY-BACKEND-SPEC §3).
 * The issues core: real errors surfaced in the IDE + fed onto the shared signal
 * rail. Crons / performance / alert-rules are follow-on slices (spec §4.2–4.4) —
 * this is the verifiable backbone. Every value is JSON-safe, non-secret.
 */

import type { SignalItem } from "./tooling";

export type SentryLevel = "error" | "warning" | "info";
export type SentryStatus = "unresolved" | "ignored" | "resolved";

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

export interface SentryProvider {
  /** The configured organization slug. */
  readonly org: string;
  /** Issues for the org (default `is:unresolved`), optionally scoped to a project/env. */
  listIssues(opts?: { query?: string; project?: string }): Promise<SentryIssue[]>;
  /** Project Sentry issues onto the shared signal rail (source `observability`). */
  toSignals(issues: SentryIssue[]): SignalItem[];
}
