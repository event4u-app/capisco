/**
 * Real Sentry provider (SENTRY-BACKEND-SPEC §3) — the issues core: live errors
 * from the Sentry Web API, mapped to the spec's Issue shape, projectable onto the
 * shared signal rail. Bearer-token mode via ProviderAuth (OAuth/MCP plug in
 * behind the same auth per the Provider-Auth directive).
 *
 * Pure mapping (`toIssue`, `toSignal`, `relTime`) is exported for deterministic
 * unit tests; the live path is integration-tested against real Sentry.
 */

import type { SecretStore, SignalItem, SignalSeverity } from "@/contracts";
import type { SentryIssue, SentryLevel, SentryProvider, SentryStatus } from "@/contracts";
import { bearerTokenAuth, type ProviderAuth } from "../auth/provider-auth.ts";
import { sentryIssues } from "./sentry-http.ts";
import { sanitizeIssueTitle, sanitizeTag } from "@/lib/sentry-sanitize.ts";

const DEFAULT_BASE = "https://sentry.io";

/** Relative time from an ISO timestamp, e.g. "2d" / "3h" / "5m" / "now". `nowMs` injectable for tests. */
export function relTime(iso: string | undefined, nowMs: number = Date.now()): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}

function level(v: unknown): SentryLevel {
  return v === "warning" || v === "info" ? v : "error";
}
function status(v: unknown): SentryStatus {
  return v === "ignored" || v === "resolved" ? v : "unresolved";
}
function trend24h(stats: unknown): number[] {
  const buckets = (stats as { "24h"?: [number, number][] } | undefined)?.["24h"];
  return Array.isArray(buckets) ? buckets.map((b) => (Array.isArray(b) ? Number(b[1]) || 0 : 0)) : [];
}

/** Pure: a Sentry API issue row → the spec's SentryIssue. */
export function toIssue(row: Record<string, unknown>, nowMs: number = Date.now()): SentryIssue {
  const project = (row.project as { slug?: string } | undefined)?.slug ?? "";
  const assignedTo = row.assignedTo as { name?: string } | string | null | undefined;
  const assignee =
    typeof assignedTo === "string" ? assignedTo : (assignedTo?.name ?? null);
  return {
    id: `${(row.shortId as string) ?? (row.id as string) ?? "?"}`,
    level: level(row.level),
    title: `${(row.title as string) ?? "Untitled"}`,
    culprit: `${(row.culprit as string) ?? ""}`,
    project,
    env: `${((row.tags as Record<string, string>) ?? {}).environment ?? ""}`,
    events: Number(row.count) || 0,
    users: Number(row.userCount) || 0,
    age: relTime(row.firstSeen as string, nowMs),
    lastSeen: relTime(row.lastSeen as string, nowMs),
    status: status(row.status),
    trend: trend24h(row.stats),
    assignee,
  };
}

/**
 * Pure: a SentryIssue → a shared-rail SignalItem (source `observability`).
 * Untrusted issue strings are sanitized here (GATE G-SENTRY-SANITIZE) so the
 * shared signal rail — a non-Sentry-aware sink — never receives raw markup,
 * an executable scheme, or an unbounded title.
 */
export function toSignal(issue: SentryIssue): SignalItem {
  const sev: SignalSeverity = issue.level === "info" ? "idle" : "warning";
  return {
    id: `sentry:${issue.id}`,
    sev,
    source: "observability",
    title: sanitizeIssueTitle(issue.title),
    sub: `${sanitizeTag(issue.project)} · ${issue.events} events · ${issue.users} users · ${sanitizeTag(issue.lastSeen)}`,
  };
}

export interface RealSentryProviderOptions {
  org: string;
  auth: ProviderAuth;
  baseUrl?: string;
}

export class RealSentryProvider implements SentryProvider {
  readonly org: string;
  readonly #auth: ProviderAuth;
  readonly #baseUrl: string;

  constructor(opts: RealSentryProviderOptions) {
    this.org = opts.org;
    this.#auth = opts.auth;
    this.#baseUrl = opts.baseUrl ?? DEFAULT_BASE;
  }

  async listIssues(opts: { query?: string; project?: string } = {}): Promise<SentryIssue[]> {
    const rows = await sentryIssues(this.#baseUrl, this.#auth, this.org, opts);
    return rows.map((r) => toIssue(r));
  }

  toSignals(issues: SentryIssue[]): SignalItem[] {
    return issues.map(toSignal);
  }
}

/** Build a Sentry provider (Bearer token from the keychain). */
export function createRealSentryProvider(opts: {
  org: string;
  secrets: SecretStore;
  baseUrl?: string;
  tokenRef?: string;
}): RealSentryProvider {
  return new RealSentryProvider({
    org: opts.org,
    auth: bearerTokenAuth(opts.secrets, opts.tokenRef ?? "sentry-token"),
    baseUrl: opts.baseUrl,
  });
}
