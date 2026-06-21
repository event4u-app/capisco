// @vitest-environment node
/**
 * Real ACP adapter resolution test (road-to-runnable-dev P4, key-gated).
 *
 * Proves the resolution layer that swaps the deterministic stub for a real
 * ACP-capable CLI behaves correctly, WITHOUT a real LLM/key (those stay
 * DEFERRED — they are user-supplied at runtime):
 *
 *  - DORMANT by default: nothing configured ⇒ no spawn shape, stub stays default.
 *  - DORMANT when the CLI is configured but not installed (no spawn-fail at run).
 *  - DORMANT when the CLI is installed but the key is not in the vault (key-gate).
 *  - LIVE when CLI installed AND key present — and the resolved `{command,args}`
 *    drives a real broker-gated ACP run that matches the stub's behaviour.
 *  - SECRETS stay credentialRef-only: the resolution registers the raw key into
 *    the broker vault under a reference NAME and never returns/echoes the value.
 *
 * The "real CLI" used here is `node <stub-acp-agent.mjs>` — a real child process
 * over the same stdio protocol — so the swap path is exercised end-to-end and
 * deterministically. A genuine `claude-code`/`codex`/`gemini` run is the same
 * code path with a different binary, gated behind the user's key + install.
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Broker } from "../broker/capability-broker.ts";
import { InMemorySessionStore } from "../session/in-memory-session-store.ts";
import { AcpSession, type PermissionResolver } from "../acp/acp-session.ts";
import type { AcpToolCall, SessionEvent } from "@/contracts";
import {
  DEFAULT_ACP_CREDENTIAL_REF,
  readRealAcpEnv,
  resolveCliPath,
  resolveRealAcpAdapter,
  type RealAcpConfig,
} from "../acp/real-acp-config.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, "..", "acp", "stub-acp-agent.mjs");
const ALLOW_ALL: PermissionResolver = () => ({ axis: "session" });

describe("real ACP adapter — config resolution (key-gated)", () => {
  it("is DORMANT with nothing configured (stub stays the default)", () => {
    const broker = new Broker();
    const resolution = resolveRealAcpAdapter({}, broker);
    expect(resolution.spawn).toBeUndefined();
    expect(resolution.dormantReason).toBe("no-cli-configured");
  });

  it("is DORMANT when the CLI is configured but not installed", () => {
    const broker = new Broker();
    const resolution = resolveRealAcpAdapter(
      { cliCommand: "definitely-not-a-real-cli-xyz", apiKey: "k" },
      broker,
      { PATH: "/nonexistent" },
    );
    expect(resolution.spawn).toBeUndefined();
    expect(resolution.dormantReason).toBe("cli-not-installed");
  });

  it("is DORMANT when the CLI is installed but no key is available (key-gate)", () => {
    const broker = new Broker();
    // The CLI resolves (an absolute path that exists) but no apiKey + nothing
    // pre-seeded in the vault under the ref ⇒ deferred.
    const resolution = resolveRealAcpAdapter({ cliCommand: process.execPath }, broker);
    expect(resolution.spawn).toBeUndefined();
    expect(resolution.dormantReason).toBe("key-not-available");
  });

  it("goes LIVE when CLI installed AND key present, registering the key by reference only", () => {
    const broker = new Broker();
    const resolution = resolveRealAcpAdapter(
      { cliCommand: process.execPath, cliArgs: [STUB], apiKey: "sk-secret-value", model: "Claude Code" },
      broker,
    );

    expect(resolution.dormantReason).toBeUndefined();
    expect(resolution.spawn?.command).toBe(process.execPath);
    expect(resolution.spawn?.args).toEqual([STUB]);
    expect(resolution.spawn?.model).toBe("Claude Code");
    expect(resolution.spawn?.credentialRef).toBe(DEFAULT_ACP_CREDENTIAL_REF);

    // SECRET STAYS credentialRef-ONLY: the vault knows the reference NAME; there
    // is no method that returns the value, and the raw key never appears in the
    // resolved spawn (no env/argv leak).
    expect(broker.secrets.list()).toContain(DEFAULT_ACP_CREDENTIAL_REF);
    expect(broker.secrets.has(DEFAULT_ACP_CREDENTIAL_REF)).toBe(true);
    expect(JSON.stringify(resolution.spawn)).not.toContain("sk-secret-value");
  });

  it("goes LIVE against a PRE-SEEDED vault key without re-supplying the raw value", () => {
    const broker = new Broker();
    // The key was put into the vault earlier (e.g. a prior session, a keychain
    // import). A later resolution with NO apiKey still goes live — proving the
    // key-gate reads the vault, not the config.
    broker.secrets.put("my-agent-key", "already-in-vault");
    const resolution = resolveRealAcpAdapter(
      { cliCommand: process.execPath, cliArgs: [STUB], credentialRef: "my-agent-key" },
      broker,
    );
    expect(resolution.spawn?.credentialRef).toBe("my-agent-key");
    expect(resolution.spawn?.command).toBe(process.execPath);
  });
});

describe("real ACP adapter — env reading (no invention)", () => {
  it("returns a dormant config when CAPISCO_ACP_CLI is unset", () => {
    expect(readRealAcpEnv({}).cliCommand).toBeUndefined();
  });

  it("reads CLI / args / model / cred-ref from the environment", () => {
    const cfg: RealAcpConfig = readRealAcpEnv({
      CAPISCO_ACP_CLI: "claude-code",
      CAPISCO_ACP_CLI_ARGS: "--acp  --quiet",
      CAPISCO_ACP_MODEL: "Claude",
      CAPISCO_ACP_CRED_REF: "anthropic-key",
      CAPISCO_ACP_API_KEY: "sk-x",
    });
    expect(cfg.cliCommand).toBe("claude-code");
    expect(cfg.cliArgs).toEqual(["--acp", "--quiet"]);
    expect(cfg.model).toBe("Claude");
    expect(cfg.credentialRef).toBe("anthropic-key");
    expect(cfg.apiKey).toBe("sk-x");
  });

  it("resolveCliPath finds node on PATH and rejects a bogus name", () => {
    // `node` is on PATH in CI; an absolute existing path resolves to itself.
    expect(resolveCliPath(process.execPath)).toBe(process.execPath);
    expect(resolveCliPath("definitely-not-a-real-cli-xyz", { PATH: "/nonexistent" })).toBeUndefined();
  });
});

describe("real ACP adapter — verified against the deterministic stub", () => {
  it("the resolved spawn drives a real broker-gated run identical to the stub's", async () => {
    const broker = new Broker();
    const store = new InMemorySessionStore();

    // Resolve the adapter LIVE, pointing the 'real CLI' at the stub agent (a real
    // child process over the same stdio protocol) with a key in the vault.
    const resolution = resolveRealAcpAdapter(
      { cliCommand: process.execPath, cliArgs: [STUB], apiKey: "sk-test", model: "Stub-as-real" },
      broker,
    );
    const spawn = resolution.spawn;
    expect(spawn).toBeDefined();
    if (!spawn) return;

    const events: SessionEvent[] = [];
    const performed: string[] = [];
    const session = new AcpSession({
      broker,
      store,
      cwd: "/tmp/worktree-real-acp",
      model: spawn.model,
      command: spawn.command,
      args: spawn.args,
      resolvePermission: ALLOW_ALL,
      perform: (call: AcpToolCall) => performed.push(`${call.kind}:${call.target}`),
    });
    session.subscribe((e) => events.push(e));

    try {
      const sessionId = await session.start("Implement the worktree teardown");

      // Same deterministic spine the stub test asserts — the swap path is exercised.
      expect(events.some((e) => e.type === "done")).toBe(true);
      expect(performed).toEqual(["file-read:README.md", "file-write:TODO-done.md"]);

      const stored = await store.get(sessionId);
      expect(stored?.model).toBe("Stub-as-real");
      expect(stored?.status).toBe("done");

      // Every action went through the broker audit — proving the real-CLI spawn
      // path is still fully broker-mediated (the un-bypassable chokepoint).
      const outcomes = broker.audit.list().map((a) => `${a.capability}:${a.outcome}`);
      expect(outcomes).toContain("file-read:executed");
      expect(outcomes).toContain("file-write:executed");
    } finally {
      session.close();
    }
  });
});
