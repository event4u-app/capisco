/**
 * Sentry issues poller (road-to-sentry-observability P1 — "Polling-first with
 * ETag + 429-backoff + last-sync-time"). The reusable CORE only: it holds the
 * ETag, the last-fetched rows, the last successful sync time, and a 429 backoff
 * window. The 30–60s interval and the "Updated Xs ago" label are the caller's
 * (wire/UI) concern — this class just answers "sync now" idempotently.
 *
 * Why a class, not a loop: keeping the schedule out means the poller is a pure
 * state machine — deterministic and unit-testable with an injected fetch, no
 * timers. Each `sync()` does at most one conditional request:
 *   - inside the backoff window → no request, returns the cached rows.
 *   - 200 → cache new rows + ETag, mark changed.
 *   - 304 → keep rows, just refresh the sync time (nothing changed upstream).
 *   - 429 → open a backoff window from Retry-After, keep rows.
 */

import type { ConditionalIssues } from "./sentry-http.ts";

export interface SentryPollResult {
  /** New rows arrived this sync (200). 304 / backoff / 429 → false. */
  changed: boolean;
  /** The current cached rows (unchanged on 304 / backoff / 429). */
  rows: Record<string, unknown>[];
  /** Last SUCCESSFUL sync (200 or 304) in epoch ms — the "Updated Xs ago" source. */
  lastSyncMs: number | null;
  /** True while a 429 backoff window is open (this sync made no request, or just opened one). */
  backingOff: boolean;
}

/** The one dependency: fetch a conditional issues page given the last ETag. */
export interface SentryPollerDeps {
  fetchIssues: (etag: string | undefined) => Promise<ConditionalIssues>;
}

export class SentryPoller {
  readonly #deps: SentryPollerDeps;
  #etag: string | undefined;
  #rows: Record<string, unknown>[] = [];
  #lastSyncMs: number | null = null;
  #backoffUntilMs = 0;

  constructor(deps: SentryPollerDeps) {
    this.#deps = deps;
  }

  /** Last successful sync time (epoch ms), or null before the first success. */
  lastSyncMs(): number | null {
    return this.#lastSyncMs;
  }

  /** The current cached rows without triggering a request. */
  rows(): Record<string, unknown>[] {
    return this.#rows;
  }

  /** Run one conditional sync (or skip it while backing off). */
  async sync(nowMs: number = Date.now()): Promise<SentryPollResult> {
    // Inside the backoff window: make NO request — spend nothing while rate-limited.
    if (nowMs < this.#backoffUntilMs) {
      return {
        changed: false,
        rows: this.#rows,
        lastSyncMs: this.#lastSyncMs,
        backingOff: true,
      };
    }
    const res = await this.#deps.fetchIssues(this.#etag);
    if (res.status === 429) {
      this.#backoffUntilMs = nowMs + (res.retryAfterMs ?? 60_000);
      return {
        changed: false,
        rows: this.#rows,
        lastSyncMs: this.#lastSyncMs,
        backingOff: true,
      };
    }
    if (res.status === 304) {
      // Unchanged upstream — keep the rows, but the sync itself succeeded.
      this.#lastSyncMs = nowMs;
      return { changed: false, rows: this.#rows, lastSyncMs: nowMs, backingOff: false };
    }
    // 200 — new data.
    this.#rows = res.rows ?? [];
    if (res.etag) this.#etag = res.etag;
    this.#lastSyncMs = nowMs;
    return { changed: true, rows: this.#rows, lastSyncMs: nowMs, backingOff: false };
  }
}
