/**
 * Deterministic Sentry-Workspace provider (road-to-sentry-observability P0,
 * prototype shared.jsx SENTRY_ISSUES / SENTRY_CRONS / SENTRY_STATS /
 * SENTRY_ALERTS). Implements the R0 data-shape interfaces; no Date.now /
 * Math.random. Values copied verbatim from the design reference.
 *
 * Browser-safe: NO imports from app/sidecar — this is frontend-only code.
 */

import type {
  SentryAlertRule,
  SentryCron,
  SentryIssue,
  SentryReadProvider,
  SentryStats,
  SignalItem,
  SignalSeverity,
} from "@/contracts";
import { sanitizeIssueTitle, sanitizeTag } from "@/lib/sentry-sanitize";

// ---------------------------------------------------------------------------
// Verbatim fixture data (design reference shared.jsx lines 377–405)
// ---------------------------------------------------------------------------

const ISSUES: SentryIssue[] = [
  {
    id: "CAP-4F2",
    level: "error",
    title: "TypeError: array_merge(): Argument #2 must be of type array, null given",
    culprit: "core/mods/zeiterfassung/functions/c_lv_time_diff.inc.php in array_merge",
    project: "capisco-web",
    env: "production",
    events: 1,
    users: 1,
    age: "3mo",
    lastSeen: "1hr ago",
    status: "unresolved",
    trend: [2, 1, 0, 3, 1, 0, 1, 4, 2, 1],
    assignee: null,
  },
  {
    id: "CAP-7A9",
    level: "error",
    title: "Diagnostic error · Record lvs#JFhrucX7ZEP5Kuxb not found",
    culprit: "BuildProductsPath/Release-iphoneos/main.jsbundle",
    project: "capisco-app",
    env: "production",
    events: 7,
    users: 0,
    age: "8mo",
    lastSeen: "5min ago",
    status: "unresolved",
    trend: [0, 1, 2, 1, 3, 5, 2, 4, 7, 5],
    assignee: "mara",
  },
  {
    id: "CAP-2C1",
    level: "warning",
    title: "Broker grant escalation timed out after 5000ms",
    culprit: "src/core/broker.ts in checkCapability",
    project: "capisco-core",
    env: "production",
    events: 34,
    users: 12,
    age: "2d",
    lastSeen: "12min ago",
    status: "unresolved",
    trend: [1, 3, 2, 5, 8, 6, 9, 12, 7, 10],
    assignee: null,
  },
  {
    id: "CAP-9B4",
    level: "error",
    title: "Unhandled promise rejection in worktree teardown",
    culprit: "src/core/worktree.ts in teardown",
    project: "capisco-core",
    env: "staging",
    events: 3,
    users: 2,
    age: "5h",
    lastSeen: "40min ago",
    status: "unresolved",
    trend: [0, 0, 1, 0, 2, 1, 0, 3, 1, 0],
    assignee: null,
  },
  {
    id: "CAP-1D7",
    level: "info",
    title: "Slow DB query: sessions aggregation > 1.2s",
    culprit: "src/core/session-tree.ts in aggregate",
    project: "capisco-core",
    env: "production",
    events: 128,
    users: 41,
    age: "1w",
    lastSeen: "2hr ago",
    status: "ignored",
    trend: [5, 8, 6, 9, 12, 10, 8, 11, 9, 7],
    assignee: "kai",
  },
  {
    id: "CAP-6E3",
    level: "error",
    title: "RedisConnectionException: read timeout",
    culprit: "src/providers/cache.ts in get",
    project: "capisco-tauri",
    env: "production",
    events: 16,
    users: 9,
    age: "4d",
    lastSeen: "6hr ago",
    status: "resolved",
    trend: [9, 7, 5, 3, 2, 1, 0, 0, 0, 0],
    assignee: "jdev",
  },
];

const CRONS: SentryCron[] = [
  {
    name: "queue-prune-failed",
    schedule: "At 0 min past the hour, every 2 hours",
    project: "capisco-api",
    status: "failing",
    lastSeen: "4d ago",
    ticks: "fffsssssfs",
    alerts: 1,
  },
  {
    name: "webhooks-failed-alert",
    schedule: "Every hour",
    project: "capisco-api",
    status: "failing",
    lastSeen: "4d ago",
    ticks: "sfssssfsss",
    alerts: 1,
  },
  {
    name: "import-equipment",
    schedule: "Every 15 min, min 3–59",
    project: "capisco-api",
    status: "ok",
    lastSeen: "4d ago",
    ticks: "ssssssssss",
    alerts: 1,
  },
  {
    name: "configuration-activate",
    schedule: "Every 15 min, min 13–59",
    project: "capisco-api",
    status: "ok",
    lastSeen: "4d ago",
    ticks: "ssssssssss",
    alerts: 1,
  },
  {
    name: "import-users-and-projects",
    schedule: "Every 15 min, min 7–59",
    project: "capisco-api",
    status: "ok",
    lastSeen: "4d ago",
    ticks: "sssssssfss",
    alerts: 1,
  },
  {
    name: "retry-failed-imports",
    schedule: "Every 15 min, min 11–59",
    project: "capisco-api",
    status: "ok",
    lastSeen: "4d ago",
    ticks: "ssssssssss",
    alerts: 1,
  },
  {
    name: "monitoring-redis-memory",
    schedule: "Every 5 min",
    project: "capisco-api",
    status: "ok",
    lastSeen: "4d ago",
    ticks: "ssssssssss",
    alerts: 1,
  },
  {
    name: "import-uploads-process",
    schedule: "Every minute",
    project: "capisco-api",
    status: "ok",
    lastSeen: "4d ago",
    ticks: "ssssssssss",
    alerts: 1,
  },
  {
    name: "webhooks-run",
    schedule: "Every minute",
    project: "capisco-api",
    status: "ok",
    lastSeen: "4d ago",
    ticks: "ssssssssss",
    alerts: 1,
  },
  {
    name: "gps-calculate-trips",
    schedule: "At 03:30",
    project: "capisco-api",
    status: "timeout",
    lastSeen: "3wk ago",
    ticks: "ssssstssss",
    alerts: 1,
  },
];

const STATS: SentryStats = {
  errors24h: 412,
  errorsTrend: "+18%",
  crashFree: "99.82%",
  failingCrons: 2,
  p95: "842 ms",
  apdex: 0.94,
};

const ALERTS: SentryAlertRule[] = [
  {
    name: "High error rate · production",
    cond: "errors > 50 in 1h",
    channel: "IDE + Slack #alerts",
    on: true,
    level: "error",
  },
  {
    name: "New issue in capisco-core",
    cond: "first seen · any level",
    channel: "IDE notification",
    on: true,
    level: "warning",
  },
  {
    name: "Cron missed check-in",
    cond: "any monitor misses",
    channel: "IDE + Email",
    on: true,
    level: "error",
  },
  {
    name: "Crash-free rate drop",
    cond: "crash-free < 99.5%",
    channel: "IDE + Slack #alerts",
    on: false,
    level: "warning",
  },
  {
    name: "p95 latency regression",
    cond: "p95 > 1000ms for 15m",
    channel: "IDE notification",
    on: false,
    level: "info",
  },
];

// ---------------------------------------------------------------------------
// Pure inline signal projection (mirrors real-sentry-provider toSignal —
// kept inline so the frontend never imports sidecar code).
// ---------------------------------------------------------------------------

function issueToSignal(issue: SentryIssue): SignalItem {
  const sev: SignalSeverity = issue.level === "info" ? "idle" : "warning";
  return {
    id: `sentry:${issue.id}`,
    sev,
    source: "observability",
    // Sanitize untrusted issue strings before they reach the shared signal rail
    // (GATE G-SENTRY-SANITIZE) — mirrors real-sentry-provider's toSignal.
    title: sanitizeIssueTitle(issue.title),
    sub: `${sanitizeTag(issue.project)} · ${issue.events} events · ${issue.users} users · ${sanitizeTag(issue.lastSeen)}`,
  };
}

// ---------------------------------------------------------------------------
// sentrySnapshot — synchronous facade for render-only dashboards
// ---------------------------------------------------------------------------

/**
 * Synchronous deterministic facade over the Sentry fixture data — for
 * render-only dashboards that are SNAPSHOT views, not event streams
 * (mirrors tasksSnapshot / gitSnapshot). No Date.now / Math.random.
 */
export const sentrySnapshot = {
  org: "capisco" as const,

  /** The workspace header stats. */
  getStats(): SentryStats {
    return { ...STATS };
  },

  /** All 6 issues in fixture order. */
  getAllIssues(): SentryIssue[] {
    return ISSUES.map((i) => ({ ...i, trend: [...i.trend] }));
  },

  /** Look up a single issue by id. */
  getIssue(id: string): SentryIssue | undefined {
    const found = ISSUES.find((i) => i.id === id);
    return found ? { ...found, trend: [...found.trend] } : undefined;
  },

  /** All 10 cron monitors in fixture order. */
  getCrons(): SentryCron[] {
    return CRONS.map((c) => ({ ...c }));
  },

  /** All 5 alert rules in fixture order. */
  getAlertRules(): SentryAlertRule[] {
    return ALERTS.map((a) => ({ ...a }));
  },
};

// ---------------------------------------------------------------------------
// mockSentryProvider — async SentryReadProvider for component testing
// ---------------------------------------------------------------------------

/**
 * Async {@link SentryReadProvider} backed by the same fixture arrays. The
 * default `listIssues` filter is `status === "unresolved"` — the same
 * behaviour as {@link FixtureSentryProvider} on the sidecar.
 */
export const mockSentryProvider: SentryReadProvider = {
  org: "capisco",

  listIssues(opts: { query?: string; project?: string } = {}): Promise<SentryIssue[]> {
    const { query, project } = opts;
    let statusFilter = "unresolved";
    if (query) {
      const m = query.match(/\bis:(\S+)/);
      if (m) statusFilter = m[1];
    }
    let result = ISSUES.filter((i) => i.status === statusFilter);
    if (project) result = result.filter((i) => i.project === project);
    return Promise.resolve(result.map((i) => ({ ...i, trend: [...i.trend] })));
  },

  listCrons(): Promise<SentryCron[]> {
    return Promise.resolve(CRONS.map((c) => ({ ...c })));
  },

  getStats(): Promise<SentryStats> {
    return Promise.resolve({ ...STATS });
  },

  listAlertRules(): Promise<SentryAlertRule[]> {
    return Promise.resolve(ALERTS.map((a) => ({ ...a })));
  },

  toSignals(issues: SentryIssue[]): SignalItem[] {
    return issues.map(issueToSignal);
  },
};
