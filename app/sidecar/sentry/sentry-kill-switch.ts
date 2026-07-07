/**
 * Sentry integration kill-switch (road-to-sentry-observability P1 — lands BEFORE
 * the real provider, on purpose). Two independent ways to switch the whole Sentry
 * surface off, so a misbehaving external integration can never take the IDE with it:
 *
 *  - **Runtime toggle** (`setEnabled`) — flips the integration off/on WITHOUT a
 *    restart, over IPC. This is the operator's manual switch.
 *  - **Force-disable** (constructor / manifest) — a remote/config override that
 *    wins over the runtime toggle. Seeded from `CAPISCO_SENTRY_DISABLED` at boot;
 *    the deferred remote-manifest fetch feeds the same flag.
 *
 * Trigger criteria for pulling the switch (Council-finding, documented so the
 * operator has thresholds, not vibes): API error rate > 10 %, broker-reject
 * rate > 20 %, or a signal flood > 50 signals / 10 min.
 *
 * When disabled, {@link createGatedSentryProvider} short-circuits every read to
 * an empty result — NO upstream call is made (no polling, no API hit, no fixture
 * read), so "off" is genuinely inert, not merely hidden.
 */

import type { SentryProvider, SentryReadProvider, SentryStats } from "@/contracts";

/** The zeroed stats returned while the integration is disabled — honest "no data". */
const DISABLED_STATS: SentryStats = {
  errors24h: 0,
  errorsTrend: "",
  crashFree: "",
  failingCrons: 0,
  p95: "",
  apdex: 0,
};

export class SentryKillSwitch {
  #runtimeEnabled = true;
  readonly #forceDisabled: boolean;

  constructor(opts: { forceDisabled?: boolean } = {}) {
    this.#forceDisabled = opts.forceDisabled ?? false;
  }

  /** Effective state: a force-disable (manifest/env) always wins over the toggle. */
  enabled(): boolean {
    return !this.#forceDisabled && this.#runtimeEnabled;
  }

  /** The no-restart runtime toggle (operator's manual switch). No effect while forced off. */
  setEnabled(on: boolean): void {
    this.#runtimeEnabled = on;
  }

  /** Whether a force-disable override is in effect (manifest/env) — surfaced for honesty. */
  forced(): boolean {
    return this.#forceDisabled;
  }
}

/**
 * Wrap a read provider so every read short-circuits to empty while the switch is
 * off — without touching the inner provider (no upstream work). `org` and the
 * pure `toSignals` pass straight through (a label + a pure projection are safe).
 */
export function createGatedSentryProvider(
  inner: SentryReadProvider,
  kill: SentryKillSwitch,
): SentryReadProvider {
  return {
    get org() {
      return inner.org;
    },
    toSignals: (issues) => inner.toSignals(issues),
    listIssues: (opts) => (kill.enabled() ? inner.listIssues(opts) : Promise.resolve([])),
    listCrons: () => (kill.enabled() ? inner.listCrons() : Promise.resolve([])),
    getStats: () =>
      kill.enabled() ? inner.getStats() : Promise.resolve({ ...DISABLED_STATS }),
    listAlertRules: () => (kill.enabled() ? inner.listAlertRules() : Promise.resolve([])),
  };
}

/**
 * Gate the ISSUES-CORE surface ({@link SentryProvider}). The real provider today
 * implements only the issues core (crons/perf/alerts are later slices), so it
 * needs its own gate — the full-read gate would call listCrons/getStats on it and
 * crash while enabled. Same discipline: off → empty listIssues, inner untouched;
 * `org` + the pure `toSignals` pass through.
 */
export function createGatedSentryCore(
  inner: SentryProvider,
  kill: SentryKillSwitch,
): SentryProvider {
  return {
    get org() {
      return inner.org;
    },
    toSignals: (issues) => inner.toSignals(issues),
    listIssues: (opts) => (kill.enabled() ? inner.listIssues(opts) : Promise.resolve([])),
  };
}
