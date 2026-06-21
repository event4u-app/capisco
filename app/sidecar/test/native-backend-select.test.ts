// @vitest-environment node
/**
 * Backend-selection test (B8 Phase 2a). Proves the NATIVE Claude-Code adapter is
 * selectable behind the SAME session interface as the stub/ACP path: `registerSession`
 * with `backend: "native"` wires the ToDo "send to agent" seam to the
 * {@link ClaudeCodeProvider} stream-json driver, and the run flows end-to-end
 * through the registered `todo` provider — broker-gated — exactly like the ACP
 * path, with the deterministic fixture replayer standing in for the real `claude`.
 *
 * Also pins that the DEFAULT (no `backend`) stays the ACP path, so the
 * mock/stub fallback and CI are unchanged.
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ProviderRegistry } from "../registry/registry.ts";
import { Broker } from "../broker/capability-broker.ts";
import { InMemorySessionStore } from "../session/in-memory-session-store.ts";
import { registerSession, SESSION_PROVIDER_ID, TODO_PROVIDER_ID } from "../register-session.ts";
import type { TodoItem, TodoProvider } from "@/contracts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_AGENT = join(HERE, "..", "acp", "stream-json-fixture-agent.mjs");
const STUB_AGENT = join(HERE, "..", "acp", "stub-acp-agent.mjs");

const TODO: TodoItem = {
  id: "todo-1",
  text: "Mark the TODO done",
  checked: false,
  line: 1,
};

describe("registerSession — native backend selection", () => {
  it("selects the native stream-json adapter and drives a broker-gated run", async () => {
    const registry = new ProviderRegistry();
    const broker = new Broker();
    const store = new InMemorySessionStore();

    registerSession(registry, broker, {
      store,
      backend: "native",
      // The human clears the gate per call (a real UI prompt); here allow-session.
      resolvePermission: () => ({ axis: "session" }),
      // Point the "real CLI" at the deterministic fixture replayer.
      command: process.execPath,
      args: [FIXTURE_AGENT],
    });

    const todo = registry.get(TODO_PROVIDER_ID) as unknown as TodoProvider;
    const sessionId = await todo.sendToAgent(TODO, "/tmp/worktree-native-select");

    // The run produced a persistent, done session through the native backend.
    const stored = await store.get(sessionId);
    expect(stored?.status).toBe("done");
    expect(stored?.model).toBe("Claude Code (native)");
    expect(await todo.statusOf(TODO.id)).toBe("done");

    // The native run is fully broker-mediated — the chokepoint audited both tools.
    const outcomes = broker.audit.list().map((a) => `${a.capability}:${a.outcome}`);
    expect(outcomes).toContain("file-read:executed");
    expect(outcomes).toContain("file-write:executed");

    // The session is registered + resumable on the same wire id as the ACP path.
    expect(registry.get(SESSION_PROVIDER_ID)).toBeDefined();
    const resumed = await store.resume(sessionId);
    expect(resumed.blocks.some((b) => b.type === "tool")).toBe(true);
  });

  it("defaults to the ACP backend (stub) when no backend is given", async () => {
    const registry = new ProviderRegistry();
    const broker = new Broker();
    const store = new InMemorySessionStore();

    registerSession(registry, broker, {
      store,
      resolvePermission: () => ({ axis: "session" }),
      command: process.execPath,
      args: [STUB_AGENT],
    });

    const todo = registry.get(TODO_PROVIDER_ID) as unknown as TodoProvider;
    const sessionId = await todo.sendToAgent(TODO, "/tmp/worktree-acp-default");
    const stored = await store.get(sessionId);
    expect(stored?.status).toBe("done");
    // The ACP stub path is fully broker-mediated too.
    const outcomes = broker.audit.list().map((a) => `${a.capability}:${a.outcome}`);
    expect(outcomes).toContain("file-read:executed");
  });
});
