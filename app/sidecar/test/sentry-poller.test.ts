// @vitest-environment node
/**
 * Sentry polling core (road-to-sentry-observability P1) — ETag conditional GET,
 * 429 backoff, and last-sync-time. Covers the HTTP layer (mock fetch) and the
 * poller state machine (injected fetch, no timers).
 */

import { describe, expect, it, vi } from "vitest";

import {
  parseRetryAfterMs,
  sentryIssuesConditional,
  type ConditionalIssues,
} from "../observability/sentry-http.ts";
import { SentryPoller } from "../observability/sentry-poller.ts";
import { selfAuth, type ProviderAuth } from "../auth/provider-auth.ts";

const auth: ProviderAuth = selfAuth("mcp"); // header() → undefined; we assert on fetch args

function res(init: {
  status: number;
  etag?: string;
  retryAfter?: string;
  body?: unknown;
}): Response {
  const headers = new Headers();
  if (init.etag) headers.set("ETag", init.etag);
  if (init.retryAfter) headers.set("Retry-After", init.retryAfter);
  return {
    status: init.status,
    ok: init.status >= 200 && init.status < 300,
    headers,
    json: () => Promise.resolve(init.body ?? []),
    text: () => Promise.resolve("err"),
  } as unknown as Response;
}

describe("parseRetryAfterMs", () => {
  it("parses delta-seconds", () => {
    expect(parseRetryAfterMs("30")).toBe(30_000);
  });
  it("parses an HTTP-date relative to now", () => {
    const now = Date.parse("2026-07-07T12:00:00Z");
    expect(parseRetryAfterMs("Tue, 07 Jul 2026 12:00:45 GMT", now)).toBe(45_000);
  });
  it("falls back when absent/garbage", () => {
    expect(parseRetryAfterMs(null, 0, 60_000)).toBe(60_000);
    expect(parseRetryAfterMs("¯\\_(ツ)_/¯", 0, 60_000)).toBe(60_000);
  });
});

describe("sentryIssuesConditional", () => {
  it("200 returns rows + the new ETag; no If-None-Match on the first call", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(res({ status: 200, etag: 'W/"abc"', body: [{ id: "1" }] }));
    const out = await sentryIssuesConditional(
      "https://sentry.io",
      auth,
      "acme",
      {},
      undefined,
      fetchImpl,
    );
    expect(out).toEqual({ status: 200, etag: 'W/"abc"', rows: [{ id: "1" }] });
    const headers = (fetchImpl.mock.calls[0][1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers["If-None-Match"]).toBeUndefined();
  });

  it("sends If-None-Match when an ETag is known and maps 304", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(res({ status: 304 }));
    const out = await sentryIssuesConditional(
      "https://sentry.io",
      auth,
      "acme",
      {},
      'W/"abc"',
      fetchImpl,
    );
    expect(out.status).toBe(304);
    const headers = (fetchImpl.mock.calls[0][1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers["If-None-Match"]).toBe('W/"abc"');
  });

  it("maps 429 with a Retry-After to a backoff hint (no throw)", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(res({ status: 429, retryAfter: "12" })));
    const out = await sentryIssuesConditional(
      "https://sentry.io",
      auth,
      "acme",
      {},
      undefined,
      fetchImpl,
      0,
    );
    expect(out).toEqual({ status: 429, retryAfterMs: 12_000 });
  });

  it("throws on other non-2xx (e.g. 401)", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(res({ status: 401 })));
    await expect(
      sentryIssuesConditional("https://sentry.io", auth, "acme", {}, undefined, fetchImpl),
    ).rejects.toThrow(/sentry 401/);
  });
});

describe("SentryPoller", () => {
  it("200 caches rows + ETag and marks changed; then reuses the ETag", async () => {
    const seen: (string | undefined)[] = [];
    const fetchIssues = vi.fn((etag: string | undefined): Promise<ConditionalIssues> => {
      seen.push(etag);
      return Promise.resolve({ status: 200, etag: 'W/"v1"', rows: [{ id: "a" }] });
    });
    const poller = new SentryPoller({ fetchIssues });
    const r1 = await poller.sync(1_000);
    expect(r1.changed).toBe(true);
    expect(r1.rows).toEqual([{ id: "a" }]);
    expect(r1.lastSyncMs).toBe(1_000);
    await poller.sync(2_000);
    expect(seen).toEqual([undefined, 'W/"v1"']); // first call no ETag, second carries it
  });

  it("304 keeps the rows but refreshes the sync time, not changed", async () => {
    let call = 0;
    const fetchIssues = (): Promise<ConditionalIssues> =>
      Promise.resolve(
        call++ === 0
          ? { status: 200, etag: "e", rows: [{ id: "a" }] }
          : { status: 304, etag: "e" },
      );
    const poller = new SentryPoller({ fetchIssues });
    await poller.sync(1_000);
    const r = await poller.sync(5_000);
    expect(r.changed).toBe(false);
    expect(r.rows).toEqual([{ id: "a" }]);
    expect(r.lastSyncMs).toBe(5_000);
  });

  it("429 opens a backoff window: no request inside it, resumes after", async () => {
    const fetchIssues = vi.fn(
      (): Promise<ConditionalIssues> => Promise.resolve({ status: 429, retryAfterMs: 10_000 }),
    );
    const poller = new SentryPoller({ fetchIssues });
    const r1 = await poller.sync(1_000); // hits 429 → backoff until 11_000
    expect(r1.backingOff).toBe(true);
    await poller.sync(5_000); // inside window → skipped
    expect(fetchIssues).toHaveBeenCalledTimes(1);
    await poller.sync(11_000); // window elapsed → requests again
    expect(fetchIssues).toHaveBeenCalledTimes(2);
  });

  it("keeps the last good rows through a 429 (never blanks the UI)", async () => {
    let call = 0;
    const fetchIssues = (): Promise<ConditionalIssues> =>
      Promise.resolve(
        call++ === 0 ? { status: 200, rows: [{ id: "a" }] } : { status: 429, retryAfterMs: 1 },
      );
    const poller = new SentryPoller({ fetchIssues });
    await poller.sync(0);
    const r = await poller.sync(1_000);
    expect(r.rows).toEqual([{ id: "a" }]); // stale-but-present beats empty
    expect(r.backingOff).toBe(true);
  });
});
