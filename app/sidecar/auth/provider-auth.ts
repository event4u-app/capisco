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
export function basicTokenAuth(
  secrets: SecretStore,
  tokenRef: string,
  user: string,
): ProviderAuth {
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

/**
 * Best-available preference for a provider that offers more than one mode
 * (real-breadth directive 2026-06-26): the richest, auth-delegated integration
 * wins, the local-tool session is the last resort.
 *
 *   MCP (server holds auth) → Web-OAuth (refreshable) → API-token (keychain) → CLI.
 */
export const AUTH_PREFERENCE: readonly AuthMode[] = ["mcp", "oauth", "token", "cli"];

/**
 * One candidate mode a provider could authenticate with. `available` is the
 * runtime probe (MCP server connected? token in the keychain? CLI logged in?);
 * `build` is called ONLY for the winning candidate, so probing never constructs
 * an auth it will not use (no needless keychain read).
 */
export interface AuthCandidate {
  mode: AuthMode;
  available: boolean;
  build: () => ProviderAuth;
}

/**
 * Pick the best available auth per {@link AUTH_PREFERENCE}. Provider code declares
 * which modes it *could* use and whether each is available right now; the resolver
 * returns the highest-preference available one — so OAuth / MCP slot in later
 * without touching the provider. `undefined` when nothing is available (the
 * provider then surfaces "not configured", never guesses).
 */
export function resolveProviderAuth(
  candidates: readonly AuthCandidate[],
): ProviderAuth | undefined {
  for (const mode of AUTH_PREFERENCE) {
    const winner = candidates.find((c) => c.mode === mode && c.available);
    if (winner) return winner.build();
  }
  return undefined;
}
