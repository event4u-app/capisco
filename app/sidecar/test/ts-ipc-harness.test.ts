import { afterEach, describe, expect, it } from "vitest";
import type { SessionEvent } from "@/contracts";
import { startTsIpcHarness, type HarnessHandle } from "../harness/ts-ipc-harness.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { createAgentProxy } from "@/lib/sidecar/client/agent-proxy.ts";
import {
  clearSidecarBridge,
  getProviders,
  installSidecarBridge,
  isDesktop,
} from "@/lib/desktop-shell.ts";

let harness: HarnessHandle | null = null;

afterEach(() => {
  clearSidecarBridge();
  harness?.dispose();
  harness = null;
});

describe("TS-IPC harness (deferred Rust shell twin)", () => {
  it("speaks the same JSON-RPC: round-trips a provider read over the bridge", async () => {
    harness = startTsIpcHarness();
    const client = new SidecarClient(harness.bridgeTransport);
    const agent = createAgentProxy(client);
    const sessions = await agent.listSessions();
    expect(sessions.length).toBeGreaterThan(0);
  });

  it("interleaves concurrent requests over the async pipe (socket-like)", async () => {
    harness = startTsIpcHarness();
    const client = new SidecarClient(harness.bridgeTransport);
    const agent = createAgentProxy(client);
    const [sessions, agents, effort] = await Promise.all([
      agent.listSessions(),
      agent.listAgents(),
      agent.listEffortLevels(),
    ]);
    expect(sessions.length).toBeGreaterThan(0);
    expect(agents.length).toBeGreaterThan(0);
    expect(effort.length).toBeGreaterThan(0);
  });

  it("streams session events through the harness bridge", async () => {
    harness = startTsIpcHarness();
    const client = new SidecarClient(harness.bridgeTransport);
    const agent = createAgentProxy(client);
    const events: SessionEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("stream timed out")), 2000);
      const off = agent.subscribe("s1", (e) => {
        events.push(e);
        if (e.type === "done") {
          clearTimeout(timeout);
          off();
          resolve();
        }
      });
    });
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("drives the DesktopShell seam end-to-end via the harness bridge", async () => {
    harness = startTsIpcHarness();
    installSidecarBridge(harness.bridgeTransport);
    expect(isDesktop()).toBe(true);
    const providers = getProviders();
    const { mockTasksProvider } = await import("@/mocks");
    const tickets = await providers.tasks.getTickets();
    expect(tickets).toEqual(await mockTasksProvider.getTickets());
  });
});
