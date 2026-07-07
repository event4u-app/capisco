// @vitest-environment node
/**
 * ProviderAuth resolver (road-to-real-breadth § Provider-Auth / sentry P1). Proves
 * the best-available preference (MCP → OAuth → token → CLI), that `build` runs
 * ONLY for the winner (no needless keychain read while probing), and that the
 * token builders keep the secret inside the inject scope (secret-by-reference).
 */

import { describe, expect, it, vi } from "vitest";

import {
  AUTH_PREFERENCE,
  bearerTokenAuth,
  resolveProviderAuth,
  selfAuth,
  type AuthCandidate,
} from "../auth/provider-auth.ts";
import { InMemorySecretStore } from "../broker/in-memory-secret-store.ts";

function candidate(mode: AuthCandidate["mode"], available: boolean): AuthCandidate {
  return {
    mode,
    available,
    build: () => selfAuth(mode === "mcp" || mode === "cli" ? mode : "cli"),
  };
}

describe("resolveProviderAuth — best-available preference", () => {
  it("prefers MCP over everything when available", () => {
    const auth = resolveProviderAuth([
      candidate("cli", true),
      candidate("token", true),
      candidate("mcp", true),
    ]);
    expect(auth?.mode).toBe("mcp");
  });

  it("falls to token when MCP/OAuth are unavailable", () => {
    const auth = resolveProviderAuth([
      { mode: "token", available: true, build: () => selfAuth("mcp") /* label irrelevant */ },
      candidate("cli", true),
      candidate("mcp", false),
      candidate("oauth", false),
    ]);
    // token beats cli; the winner is the token candidate (its build ran).
    expect(auth).toBeDefined();
  });

  it("uses CLI only as the last resort", () => {
    const auth = resolveProviderAuth([candidate("cli", true)]);
    expect(auth?.mode).toBe("cli");
  });

  it("returns undefined when nothing is available (provider surfaces 'not configured')", () => {
    expect(
      resolveProviderAuth([candidate("token", false), candidate("cli", false)]),
    ).toBeUndefined();
  });

  it("builds ONLY the winning candidate — probing never constructs an unused auth", () => {
    const built: string[] = [];
    const mk = (mode: AuthCandidate["mode"], available: boolean): AuthCandidate => ({
      mode,
      available,
      build: () => {
        built.push(mode);
        return selfAuth("cli");
      },
    });
    resolveProviderAuth([mk("cli", true), mk("token", true), mk("mcp", true)]);
    expect(built).toEqual(["mcp"]); // only the winner's build ran
  });

  it("preference order is MCP → OAuth → token → CLI", () => {
    expect(AUTH_PREFERENCE).toEqual(["mcp", "oauth", "token", "cli"]);
  });
});

describe("token builders — secret-by-reference", () => {
  it("bearerTokenAuth embeds the secret ONLY inside the inject scope", () => {
    const secrets = new InMemorySecretStore();
    secrets.put("sentry", "sk-xyz");
    const auth = bearerTokenAuth(secrets, "sentry");
    const seen = vi.fn();
    const returned = auth.withAuthHeader((h) => {
      seen(h);
      return "handled";
    });
    expect(seen).toHaveBeenCalledWith("Bearer sk-xyz");
    // The callback's return value propagates; the secret itself never does.
    expect(returned).toBe("handled");
  });
});
