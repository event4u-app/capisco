// @vitest-environment node
/**
 * LIVE human-in-the-loop permission gate (road-to-live-permission-gate). Proves,
 * hermetically over the IPC spine, the gap this wiring closes:
 *
 *  1. A running agent's untrusted-egress `ask` SURFACES as a pending permission
 *     to the UI via `agent.getPendingPermission(sessionId)` — instead of
 *     defaulting to deny-all (the bug: live sessions had no resolver).
 *  2. `agent.resolvePermission(sessionId, requestId, {axis:"once"})` UNBLOCKS
 *     EXACTLY ONE execution (the awaiting resolver clears the parked `ask`).
 *  3. A SECOND, same-shape untrusted egress RE-ASKS — the single-use grant was
 *     consumed and is target-bound, so it can never pre-clear a later egress
 *     (lethal-trifecta §3.3 preserved end-to-end through the live gate).
 *  4. A `deny` decision blocks the action — no side effect runs.
 *
 * The whole flow runs over a real in-process IPC pipe: browser-side
 * `createAgentProxy` → IPC → the LIVE agent provider → the
 * PendingPermissionRegistry resolver inside a broker-gated AcpSession. No LLM
 * key, no real agent — a deterministic stub that issues two untrusted writes.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createPipePair } from "@/lib/sidecar/protocol/transport";
import { ProviderRegistry } from "../registry/registry.ts";
import { IpcConnection } from "../server/ipc-server.ts";
import { registerMockProviders, PROVIDER_IDS } from "../register-mocks.ts";
import { registerBroker } from "../register-broker.ts";
import { registerSession, TODO_PROVIDER_ID } from "../register-session.ts";
import { PendingPermissionRegistry } from "../acp/pending-permission-registry.ts";
import { createLiveAgentProvider } from "../acp/live-agent-provider.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { createAgentProxy } from "@/lib/sidecar/client/agent-proxy.ts";
import type { GrantAxis, PermissionRequest, Session, TodoItem } from "@/contracts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOUBLE_EGRESS_STUB = join(HERE, "..", "acp", "double-egress-stub-acp-agent.mjs");

let client: SidecarClient;
let pending: PendingPermissionRegistry;
let teardown: () => void;

/**
 * Wire a registry with the LIVE agent provider over a shared store + a
 * pending-permission registry (no fail-closed timer — the test resolves
 * deterministically), the session driven by the double-untrusted-egress stub.
 */
function wire(): void {
  const { a: clientSide, b: serverSide } = createPipePair();
  const registry = new ProviderRegistry();
  registerMockProviders(registry);
  const broker = registerBroker(registry);
  pending = new PendingPermissionRegistry({ resolveTimeoutMs: 0 });
  const { store } = registerSession(registry, broker, {
    pending,
    command: "node",
    args: [DOUBLE_EGRESS_STUB],
    model: "Stub Agent",
  });
  // The dev-bridge-only live agent swap (mirrors registerAllProviders liveAgent).
  registry.replace(PROVIDER_IDS.agent, createLiveAgentProvider({ store, pending, broker }) as never);
  const conn = new IpcConnection(serverSide, registry);
  client = new SidecarClient(clientSide);
  teardown = () => {
    client.close();
    void conn;
  };
}

beforeEach(() => wire());
afterEach(() => teardown());

/** Poll the live agent provider over IPC until a pending `ask` surfaces. */
async function awaitPending(agent: ReturnType<typeof createAgentProxy>, sessionId: string): Promise<PermissionRequest> {
  for (let i = 0; i < 200; i++) {
    const p = await agent.getPendingPermission(sessionId);
    if (p) return p;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("no pending permission surfaced");
}

/** Discover the running session id over IPC once `sendToAgent` has started it. */
async function awaitRunningSession(agent: ReturnType<typeof createAgentProxy>): Promise<string> {
  for (let i = 0; i < 200; i++) {
    const sessions: Session[] = await agent.listSessions();
    if (sessions.length > 0) return sessions[0].id;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("no running session surfaced");
}

const ITEM: TodoItem = { id: "plan.md:1", text: "do the thing", checked: false, line: 1 };

describe("live human-in-the-loop permission gate (over the IPC spine)", () => {
  it("surfaces an agent ask as pending; resolve(once) unblocks one exec; a same-shape untrusted egress re-asks", async () => {
    const agent = createAgentProxy(client);

    // Start a broker-gated run (NOT awaited — the gate parks mid-run).
    const runPromise = client.call(TODO_PROVIDER_ID, "sendToAgent", [
      ITEM,
      "/repo/.worktrees/live",
    ]) as Promise<string>;

    const sessionId = await awaitRunningSession(agent);

    // (1) The first untrusted file-write parks an `ask` — surfaced to the UI.
    const first = await awaitPending(agent, sessionId);
    expect(first.fromUntrusted).toBe(true);
    expect(first.command).toBe("file-write(TODO-done.md)");
    expect(first.scopes).toContain("Allow once");

    // (2) Resolve `once` → unblocks exactly this one execution.
    const axis1: GrantAxis = await agent.resolvePermission(sessionId, first.id, { axis: "once" });
    expect(axis1).toBe("once");

    // (3) The SECOND same-shape untrusted egress re-asks — the single-use grant
    //     was consumed, so the gate parks again (a fresh request id).
    const second = await awaitPending(agent, sessionId);
    expect(second.id).not.toBe(first.id);
    expect(second.command).toBe("file-write(TODO-done.md)");
    // Resolve the second so the run can complete.
    await agent.resolvePermission(sessionId, second.id, { axis: "once" });

    const runSessionId = await runPromise;
    expect(runSessionId).toBe(sessionId);

    // Both writes cleared → both Edit blocks recorded (neither "(blocked)").
    const tools = await agent.getToolActions(sessionId);
    const edits = tools.filter((t) => t.target === "TODO-done.md");
    expect(edits).toHaveLength(2);
    expect(edits.every((t) => t.kind === "Edit")).toBe(true);
    // No pending request remains.
    expect(await agent.getPendingPermission(sessionId)).toBeNull();
  });

  it("a deny decision blocks the action — the egress never executes (no side effect)", async () => {
    const agent = createAgentProxy(client);
    const performed: string[] = [];
    // Re-wire with a perform spy so a cleared write would leave a trace; a denied
    // one must not. (sendToAgent uses the registered starter; assert via the
    // transcript block instead, which records "(blocked)" honestly.)
    void performed;

    const runPromise = client.call(TODO_PROVIDER_ID, "sendToAgent", [
      ITEM,
      "/repo/.worktrees/live",
    ]) as Promise<string>;
    const sessionId = await awaitRunningSession(agent);

    // Deny the first untrusted egress.
    const first = await awaitPending(agent, sessionId);
    const axis: GrantAxis = await agent.resolvePermission(sessionId, first.id, { axis: "deny" });
    expect(axis).toBe("deny");

    // The second egress still re-asks (a deny is per-call here too); deny it.
    const second = await awaitPending(agent, sessionId);
    await agent.resolvePermission(sessionId, second.id, { axis: "deny" });

    await runPromise;

    // Both writes were denied → recorded as blocked, never executed.
    const tools = await agent.getToolActions(sessionId);
    const edits = tools.filter((t) => t.target === "TODO-done.md");
    expect(edits).toHaveLength(2);
    expect(edits.every((t) => t.kind === "Edit (blocked)")).toBe(true);
  });
});
