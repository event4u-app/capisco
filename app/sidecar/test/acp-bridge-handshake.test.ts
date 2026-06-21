// @vitest-environment node
/**
 * ACP-via-bridge handshake test (B8 P2b). Proves OUR side of the standard ACP
 * protocol is correct WITHOUT fetching or running the real
 * `@zed-industries/claude-code-acp` bridge (that is the user's broker-approved
 * go — it would drive a real/paid Claude call). The fake bridge stub
 * (`fake-acp-bridge.mjs`) speaks standard ACP and REQUIRES the `initialize`
 * handshake before `session/new`, exactly like the real bridge.
 *
 * Three properties:
 *  1. With the handshake on, the ACP backend negotiates `initialize` first and
 *     drives a full broker-gated run end-to-end through the registered `todo`
 *     provider — same chokepoint audit as the stub/native paths.
 *  2. Without the handshake, the fake bridge rejects `session/new` (the
 *     `before initialize` error), so the run never completes — the handshake is
 *     load-bearing, not cosmetic.
 *  3. `resolveBridgeSpawn` resolves the bridge from `CAPISCO_ACP_CLI` (installed
 *     bin) or falls back to `npx @zed-industries/claude-code-acp`, marking the
 *     spawn `handshake: true` and needing NO raw key (existing Claude login).
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ProviderRegistry } from "../registry/registry.ts";
import { Broker } from "../broker/capability-broker.ts";
import { InMemorySessionStore } from "../session/in-memory-session-store.ts";
import { registerSession, TODO_PROVIDER_ID } from "../register-session.ts";
import {
  ACP_BRIDGE_BIN,
  ACP_BRIDGE_PACKAGE,
  resolveBridgeSpawn,
} from "../acp/real-acp-config.ts";
import type { TodoItem, TodoProvider } from "@/contracts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FAKE_BRIDGE = join(HERE, "..", "acp", "fake-acp-bridge.mjs");

const TODO: TodoItem = { id: "todo-1", text: "Mark the TODO done", checked: false, line: 1 };

describe("registerSession — ACP-via-bridge handshake (P2b)", () => {
  it("negotiates the ACP initialize handshake, then drives a broker-gated run", async () => {
    const registry = new ProviderRegistry();
    const broker = new Broker();
    const store = new InMemorySessionStore();

    registerSession(registry, broker, {
      store,
      backend: "acp",
      handshake: true, // bridge path requires it
      resolvePermission: () => ({ axis: "session" }),
      command: process.execPath,
      args: [FAKE_BRIDGE],
      model: "Claude Code (via ACP)",
    });

    const todo = registry.get(TODO_PROVIDER_ID) as unknown as TodoProvider;
    const sessionId = await todo.sendToAgent(TODO, "/tmp/worktree-acp-bridge");

    const stored = await store.get(sessionId);
    expect(stored?.status).toBe("done");
    expect(stored?.model).toBe("Claude Code (via ACP)");
    expect(await todo.statusOf(TODO.id)).toBe("done");

    // The bridge run is fully broker-mediated — the chokepoint audited both tools.
    const outcomes = broker.audit.list().map((a) => `${a.capability}:${a.outcome}`);
    expect(outcomes).toContain("file-read:executed");
    expect(outcomes).toContain("file-write:executed");
  });

  it("fails when the handshake is skipped — the bridge rejects session/new before initialize", async () => {
    const registry = new ProviderRegistry();
    const broker = new Broker();
    const store = new InMemorySessionStore();

    registerSession(registry, broker, {
      store,
      backend: "acp",
      handshake: false, // wrong for the bridge — it requires initialize first
      resolvePermission: () => ({ axis: "session" }),
      command: process.execPath,
      args: [FAKE_BRIDGE],
    });

    const todo = registry.get(TODO_PROVIDER_ID) as unknown as TodoProvider;
    // session/new is rejected (`before initialize`), so the start rejects.
    await expect(todo.sendToAgent(TODO, "/tmp/worktree-acp-bridge-nohandshake")).rejects.toThrow(
      /before initialize/,
    );
  });
});

describe("resolveBridgeSpawn — bridge resolution (P2b)", () => {
  it("resolves an installed claude-code-acp bin from PATH, no raw key", () => {
    // A fake PATH dir containing a `claude-code-acp` executable.
    const binDir = join(HERE, "fixtures", "fake-bin");
    const resolution = resolveBridgeSpawn(
      {},
      { PATH: binDir } as NodeJS.ProcessEnv,
    );
    expect(resolution.spawn).toBeDefined();
    expect(resolution.spawn?.command).toContain(ACP_BRIDGE_BIN);
    expect(resolution.spawn?.handshake).toBe(true);
    // The bridge uses the existing Claude login — no credentialRef.
    expect(resolution.spawn?.credentialRef).toBeUndefined();
  });

  it("falls back to `npx @zed-industries/claude-code-acp` when only npx is present", () => {
    const binDir = join(HERE, "fixtures", "fake-bin-npx");
    const resolution = resolveBridgeSpawn(
      {},
      { PATH: binDir } as NodeJS.ProcessEnv,
    );
    expect(resolution.spawn).toBeDefined();
    expect(resolution.spawn?.command).toContain("npx");
    expect(resolution.spawn?.args).toEqual(["-y", ACP_BRIDGE_PACKAGE]);
    expect(resolution.spawn?.handshake).toBe(true);
  });

  it("stays dormant when neither the bridge bin nor npx resolves", () => {
    const resolution = resolveBridgeSpawn({}, { PATH: "/nonexistent" } as NodeJS.ProcessEnv);
    expect(resolution.spawn).toBeUndefined();
    expect(resolution.dormantReason).toBe("cli-not-installed");
  });

  it("uses an explicit CAPISCO_ACP_CLI bridge command when installed", () => {
    const binDir = join(HERE, "fixtures", "fake-bin");
    const resolution = resolveBridgeSpawn(
      { cliCommand: ACP_BRIDGE_BIN },
      { PATH: binDir } as NodeJS.ProcessEnv,
    );
    expect(resolution.spawn?.command).toContain(ACP_BRIDGE_BIN);
    expect(resolution.spawn?.handshake).toBe(true);
  });
});
