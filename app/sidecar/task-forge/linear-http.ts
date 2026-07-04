/**
 * Read-only Linear GraphQL client (road-to-real-breadth P0, second task backend).
 * Linear's API is a single SaaS endpoint (api.linear.app/graphql); auth via
 * {@link ProviderAuth} — a personal API key is the raw `Authorization` value
 * (rawTokenAuth), an OAuth access token is `Bearer` (bearerTokenAuth).
 *
 * Read-only: GraphQL is POST even for reads, so this is a `fetch` egress
 * primitive (allowlisted, explicit review) — but it REFUSES any `mutation`
 * document, so it can only query.
 */

import type { ProviderAuth } from "../auth/provider-auth.ts";

const ENDPOINT = "https://api.linear.app/graphql";

export class LinearError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(`linear ${status}: ${message}`);
    this.status = status;
  }
}

/** Run a read-only GraphQL query. Refuses mutations (this primitive only reads). */
export async function linearQuery<T = unknown>(
  auth: ProviderAuth,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  if (/\bmutation\b/i.test(query)) {
    throw new LinearError(0, "read-only primitive — mutations refused");
  }
  const res = await auth.withAuthHeader((header) =>
    fetch(ENDPOINT, {
      method: "POST",
      headers: {
        ...(header ? { Authorization: header } : {}),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    }),
  );
  if (!res.ok) throw new LinearError(res.status, (await res.text()).slice(0, 300));
  const body = (await res.json()) as { data?: T; errors?: unknown };
  if (body.errors) throw new LinearError(200, JSON.stringify(body.errors).slice(0, 300));
  return body.data as T;
}
