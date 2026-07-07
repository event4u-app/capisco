// @vitest-environment node
/**
 * Write-only credential provider (road-to-shell-and-chat-really-work P1). Proves
 * the gear's Save path persists a token through the broker SecretStore and that
 * NO read path exists — the value is retrievable only via the store's
 * execution-layer `inject`, never handed back across the provider.
 */

import { describe, expect, it } from "vitest";

import { createCredentialsProvider } from "../acp/credentials-provider.ts";
import { InMemorySecretStore } from "../broker/in-memory-secret-store.ts";
import { AGENT_API_TOKEN_REF } from "@/contracts";

describe("createCredentialsProvider", () => {
  it("put() persists the token into the secret store; has() reports presence", async () => {
    const secrets = new InMemorySecretStore();
    const creds = createCredentialsProvider(secrets);

    expect(await creds.has(AGENT_API_TOKEN_REF)).toBe(false);
    await creds.put(AGENT_API_TOKEN_REF, "sk-ant-secret-123");
    expect(await creds.has(AGENT_API_TOKEN_REF)).toBe(true);

    // The value landed in the vault and is reachable ONLY via injection.
    let injected: string | undefined;
    secrets.inject(AGENT_API_TOKEN_REF, (v) => (injected = v));
    expect(injected).toBe("sk-ant-secret-123");
  });

  it("exposes no read path — only put + has (never the value)", () => {
    const creds = createCredentialsProvider(new InMemorySecretStore());
    expect(Object.keys(creds).sort()).toEqual(["has", "put"]);
  });

  it("put() replaces an existing token under the same ref", async () => {
    const secrets = new InMemorySecretStore();
    const creds = createCredentialsProvider(secrets);
    await creds.put(AGENT_API_TOKEN_REF, "old");
    await creds.put(AGENT_API_TOKEN_REF, "new");
    let seen: string | undefined;
    secrets.inject(AGENT_API_TOKEN_REF, (v) => (seen = v));
    expect(seen).toBe("new");
    // One ref, not two — no key proliferation.
    expect(secrets.list()).toEqual([AGENT_API_TOKEN_REF]);
  });
});
