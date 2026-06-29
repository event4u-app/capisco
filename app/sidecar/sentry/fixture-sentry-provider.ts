/**
 * {@link FixtureSentryProvider} (road-to-sentry-observability P0) — maps
 * SentryIssues / crons / stats / alert rules out of a recorded Sentry fixture,
 * deterministically. The shipped read-only provider; a live Sentry adapter is a
 * thin swap behind the same interface (fixtures → API client + token injected at
 * the execution layer).
 *
 * Pure by construction: it takes a {@link SentryFixture} *object*, not a file
 * path — so it is browser-safe and unit-testable with no I/O. The node-side
 * loader (`load-fixtures.ts`) reads the JSON and hands it in. No Date.now /
 * Math.random.
 */

import type { SignalItem } from "@/contracts";
import type {
  SentryAlertRule,
  SentryCron,
  SentryIssue,
  SentryReadProvider,
  SentryStats,
} from "@/contracts";
import { toSignal } from "../observability/real-sentry-provider.ts";

/** The envelope shape of a recorded Sentry fixture (matches capisco.sentry.json). */
export interface SentryFixture {
  org: string;
  issues: SentryIssue[];
  crons: SentryCron[];
  stats: SentryStats;
  alerts: SentryAlertRule[];
}

export class FixtureSentryProvider implements SentryReadProvider {
  readonly org: string;
  private readonly issues: readonly SentryIssue[];
  private readonly crons: readonly SentryCron[];
  private readonly stats: SentryStats;
  private readonly alertRules: readonly SentryAlertRule[];

  constructor(fixture: SentryFixture) {
    this.org = fixture.org;
    // Defensive copies — the provider never mutates the recorded fixture.
    this.issues = fixture.issues.map((i) => ({ ...i, trend: [...i.trend] }));
    this.crons = fixture.crons.map((c) => ({ ...c }));
    this.stats = { ...fixture.stats };
    this.alertRules = fixture.alerts.map((a) => ({ ...a }));
  }

  /**
   * List issues from the fixture. Default filter: `status === "unresolved"`.
   * Supports `is:<status>` query override and optional project filter.
   */
  listIssues(opts: { query?: string; project?: string } = {}): Promise<SentryIssue[]> {
    const { query, project } = opts;

    // Parse `is:<status>` from query string; fall back to "unresolved".
    let statusFilter: string = "unresolved";
    if (query) {
      const m = query.match(/\bis:(\S+)/);
      if (m) statusFilter = m[1];
    }

    let result = this.issues.filter((i) => i.status === statusFilter);
    if (project) {
      result = result.filter((i) => i.project === project);
    }
    return Promise.resolve(result.map((i) => ({ ...i, trend: [...i.trend] })));
  }

  listCrons(): Promise<SentryCron[]> {
    return Promise.resolve(this.crons.map((c) => ({ ...c })));
  }

  getStats(): Promise<SentryStats> {
    return Promise.resolve({ ...this.stats });
  }

  listAlertRules(): Promise<SentryAlertRule[]> {
    return Promise.resolve(this.alertRules.map((a) => ({ ...a })));
  }

  /** Project issues onto the shared signal rail (source `observability`). */
  toSignals(issues: SentryIssue[]): SignalItem[] {
    return issues.map(toSignal);
  }
}
