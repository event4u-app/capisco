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

async function getJson(url: string, auth: ProviderAuth): Promise<unknown> {
  const res = await auth.withAuthHeader((header) =>
    fetch(url, { headers: { ...(header ? { Authorization: header } : {}), Accept: "application/json" } }),
  );
  if (!res.ok) throw new SentryError(res.status, (await res.text()).slice(0, 300));
  return res.json();
}

/** Raw Sentry issue rows for an org (read-only). */
export async function sentryIssues(
  baseUrl: string,
  auth: ProviderAuth,
  org: string,
  opts: { query?: string; project?: string; environment?: string; statsPeriod?: string; limit?: number } = {},
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams();
  params.set("query", opts.query ?? "is:unresolved");
  params.set("statsPeriod", opts.statsPeriod ?? "24h");
  params.set("limit", String(opts.limit ?? 25));
  if (opts.project) params.set("project", opts.project);
  if (opts.environment) params.set("environment", opts.environment);
  const url = `${base(baseUrl)}/api/0/organizations/${encodeURIComponent(org)}/issues/?${params.toString()}`;
  const data = await getJson(url, auth);
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

/** The authenticated org memberships (validates the token + scopes). */
export async function sentryOrgs(baseUrl: string, auth: ProviderAuth): Promise<Record<string, unknown>[]> {
  const data = await getJson(`${base(baseUrl)}/api/0/organizations/`, auth);
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}
