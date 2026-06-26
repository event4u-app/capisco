/**
 * Read-only Jira Cloud REST client (road-to-real-breadth P0). The first net
 * adapter in the sidecar — GET-only, fixed base URL, auth via {@link ProviderAuth}
 * (the token is injected at the execution layer inside `withAuthHeader`, never in
 * a variable/log/LLM-context). Allowlisted in the broker-chokepoint test as a
 * `fetch` egress primitive (explicit review): it can only READ Jira.
 *
 * Uses the current `/rest/api/3/search/jql` endpoint (the legacy `/search` is
 * deprecated on Jira Cloud).
 */

import type { ProviderAuth } from "../auth/provider-auth.ts";

export class JiraError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(`jira ${status}: ${message}`);
    this.status = status;
  }
}

function base(url: string): string {
  return url.replace(/\/+$/, "");
}

async function getJson(url: string, auth: ProviderAuth): Promise<unknown> {
  const res = await auth.withAuthHeader((header) =>
    fetch(url, {
      headers: {
        ...(header ? { Authorization: header } : {}),
        Accept: "application/json",
      },
    }),
  );
  if (!res.ok) throw new JiraError(res.status, (await res.text()).slice(0, 300));
  return res.json();
}

export interface JiraMyself {
  accountId: string;
  emailAddress?: string;
  displayName: string;
}

/** The authenticated user (validates creds + resolves identity). */
export async function jiraMyself(baseUrl: string, auth: ProviderAuth): Promise<JiraMyself> {
  return (await getJson(`${base(baseUrl)}/rest/api/3/myself`, auth)) as JiraMyself;
}

export interface JiraIssue {
  key: string;
  fields: Record<string, unknown>;
}

/** Search issues by JQL (read-only). `fields` is the field allowlist to return. */
export async function jiraSearch(
  baseUrl: string,
  auth: ProviderAuth,
  jql: string,
  fields: readonly string[],
  maxResults = 100,
): Promise<JiraIssue[]> {
  const u =
    `${base(baseUrl)}/rest/api/3/search/jql` +
    `?jql=${encodeURIComponent(jql)}` +
    `&maxResults=${maxResults}` +
    `&fields=${encodeURIComponent(fields.join(","))}`;
  const data = (await getJson(u, auth)) as { issues?: JiraIssue[] };
  return data.issues ?? [];
}
