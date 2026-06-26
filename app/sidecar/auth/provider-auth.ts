/**
 * ProviderAuth — the multi-mode auth abstraction for ALL external providers
 * (road-to-real-breadth § Provider-Auth; directive 2026-06-26). Every provider
 * (forge, tasks, observability) talks to a ProviderAuth, never a fixed mode, so
 * MCP / web-OAuth / API-token / CLI plug in behind the same surface and the
 * best-available wins.
 *
 * Modes:
 *   - "token" : Basic/Bearer header from the OS keychain — secret-by-reference,
 *               the value lives ONLY inside the SecretStore.inject scope, never
 *               in a variable, log, or the LLM context.
 *   - "cli"   : the auth lives in a local tool's session (e.g. `gh`) — the
 *               adapter shells the tool, no header here (header() → undefined).
 *   - "oauth" : interactive web login (Bearer, refreshable) — next mode.
 *   - "mcp"   : an MCP server holds the auth — the adapter calls MCP, no header.
 *
 * `withAuthHeader(use)` scopes the Authorization header (which embeds the secret
 * for token/oauth) to the `use` callback — the same execution-layer-only
 * discipline as the broker's secret injection.
 */

import type { SecretStore } from "@/contracts";

export type AuthMode = "mcp" | "oauth" | "token" | "cli";

export interface ProviderAuth {
  readonly mode: AuthMode;
  /**
   * Run `use` with the Authorization header value (or undefined for cli/mcp
   * transports that authenticate themselves). The header — and the secret it
   * embeds — never escapes this call.
   */
  withAuthHeader<T>(use: (header: string | undefined) => T): T;
}

function base64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

/** API-token Basic auth (e.g. Jira Cloud `email:token`), value from the keychain. */
export function basicTokenAuth(secrets: SecretStore, tokenRef: string, user: string): ProviderAuth {
  return {
    mode: "token",
    withAuthHeader: (use) =>
      secrets.inject(tokenRef, (token) => use(`Basic ${base64(`${user}:${token}`)}`)),
  };
}

/** API-token Bearer auth (e.g. GitHub/GitLab PAT, Sentry token), value from the keychain. */
export function bearerTokenAuth(secrets: SecretStore, tokenRef: string): ProviderAuth {
  return {
    mode: "token",
    withAuthHeader: (use) => secrets.inject(tokenRef, (token) => use(`Bearer ${token}`)),
  };
}

/** Raw-token auth — the key IS the header value (e.g. a Linear personal API key). */
export function rawTokenAuth(secrets: SecretStore, tokenRef: string): ProviderAuth {
  return {
    mode: "token",
    withAuthHeader: (use) => secrets.inject(tokenRef, (token) => use(token)),
  };
}

/** CLI / MCP transports authenticate themselves — no header at the HTTP layer. */
export function selfAuth(mode: "cli" | "mcp"): ProviderAuth {
  return { mode, withAuthHeader: (use) => use(undefined) };
}
