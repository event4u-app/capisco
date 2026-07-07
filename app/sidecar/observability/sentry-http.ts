/**
 * Read-only Sentry Web API client (SENTRY-BACKEND-SPEC §2). GET-only, Bearer
 * auth via {@link ProviderAuth} (token from the keychain, secret-by-reference).
 * Allowlisted in the broker-chokepoint test as a `fetch` egress primitive.
 *
 * Default base `https://sentry.io`; a self-hosted base URL is supported.
 */

import type { ProviderAuth } from "../auth/provider-auth.ts";

export class SentryError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(`sentry ${status}: ${message}`);
    this.status = status;
  }
}

function base(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Injectable for tests — defaults to the global `fetch`. */
export type FetchImpl = typeof fetch;

async function getJson(
  url: string,
  auth: ProviderAuth,
  fetchImpl: FetchImpl = fetch,
): Promise<unknown> {
  const res = await auth.withAuthHeader((header) =>
    fetchImpl(url, {
      headers: { ...(header ? { Authorization: header } : {}), Accept: "application/json" },
    }),
  );
  if (!res.ok) throw new SentryError(res.status, (await res.text()).slice(0, 300));
  return res.json();
}

export interface SentryIssuesOpts {
  query?: string;
  project?: string;
  environment?: string;
  statsPeriod?: string;
  limit?: number;
}

/** The org-issues URL for the given filters (shared by the plain + conditional reads). */
function issuesUrl(baseUrl: string, org: string, opts: SentryIssuesOpts): string {
  const params = new URLSearchParams();
  params.set("query", opts.query ?? "is:unresolved");
  params.set("statsPeriod", opts.statsPeriod ?? "24h");
  params.set("limit", String(opts.limit ?? 25));
  if (opts.project) params.set("project", opts.project);
  if (opts.environment) params.set("environment", opts.environment);
  return `${base(baseUrl)}/api/0/organizations/${encodeURIComponent(org)}/issues/?${params.toString()}`;
}

/** Raw Sentry issue rows for an org (read-only). */
export async function sentryIssues(
  baseUrl: string,
  auth: ProviderAuth,
  org: string,
  opts: SentryIssuesOpts = {},
): Promise<Record<string, unknown>[]> {
  const data = await getJson(issuesUrl(baseUrl, org, opts), auth);
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

/** Parse a `Retry-After` header (delta-seconds; HTTP-date fallback) → ms. */
export function parseRetryAfterMs(
  value: string | null,
  nowMs: number = Date.now(),
  fallbackMs = 60_000,
): number {
  if (!value) return fallbackMs;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? fallbackMs : Math.max(0, date - nowMs);
}

/** Outcome of one conditional issues read — the 304 / 429 control-flow states are
 * NOT errors (the poller acts on them); any other non-2xx still throws. */
export interface ConditionalIssues {
  status: 200 | 304 | 429;
  /** New ETag on a 200; carry it into the next request as `If-None-Match`. */
  etag?: string;
  /** Rows on a 200 (absent on 304 — unchanged — and on 429). */
  rows?: Record<string, unknown>[];
  /** Backoff hint on a 429. */
  retryAfterMs?: number;
}

/**
 * Conditional org-issues read: sends `If-None-Match` when an ETag is known, so an
 * unchanged result comes back as a cheap 304 (no body). A 429 returns its
 * `Retry-After` as ms for the caller's backoff. Any other non-2xx throws.
 */
export async function sentryIssuesConditional(
  baseUrl: string,
  auth: ProviderAuth,
  org: string,
  opts: SentryIssuesOpts = {},
  etag?: string,
  fetchImpl: FetchImpl = fetch,
  nowMs: number = Date.now(),
): Promise<ConditionalIssues> {
  const res = await auth.withAuthHeader((header) =>
    fetchImpl(issuesUrl(baseUrl, org, opts), {
      headers: {
        ...(header ? { Authorization: header } : {}),
        Accept: "application/json",
        ...(etag ? { "If-None-Match": etag } : {}),
      },
    }),
  );
  if (res.status === 304) return { status: 304, etag };
  if (res.status === 429) {
    return {
      status: 429,
      retryAfterMs: parseRetryAfterMs(res.headers.get("Retry-After"), nowMs),
    };
  }
  if (!res.ok) throw new SentryError(res.status, (await res.text()).slice(0, 300));
  const json = await res.json();
  return {
    status: 200,
    etag: res.headers.get("ETag") ?? undefined,
    rows: Array.isArray(json) ? (json as Record<string, unknown>[]) : [],
  };
}

/** The authenticated org memberships (validates the token + scopes). */
export async function sentryOrgs(
  baseUrl: string,
  auth: ProviderAuth,
): Promise<Record<string, unknown>[]> {
  const data = await getJson(`${base(baseUrl)}/api/0/organizations/`, auth);
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}
