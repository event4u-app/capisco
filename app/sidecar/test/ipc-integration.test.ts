import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import type { SessionEvent } from "@/contracts";
import { createSidecar } from "../main.ts";
import type { Sidecar } from "../server/sidecar.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { SocketClientTransport } from "../client/socket-client-transport.ts";
import { createAgentProxy } from "@/lib/sidecar/client/agent-proxy.ts";

let dir: string;
let socketPath: string;
let sidecar: Sidecar;

async function connect(): Promise<SidecarClient> {
  const transport = await SocketClientTransport.connect(socketPath);
  return new SidecarClient(transport);
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "capisco-ipc-"));
  socketPath = join(dir, "sidecar.sock");
  // Keep the machine-wide recent-projects file inside the temp dir — never
  // touch the developer's real ~/.config during tests.
  process.env.CAPISCO_RECENT_FILE = join(dir, "recent-projects.json");
  sidecar = createSidecar(socketPath);
  await sidecar.listen();
});

afterEach(async () => {
  await sidecar.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("sidecar IPC over a real unix socket", () => {
  it("exposes the registered providers", () => {
    expect(sidecar.registry.list()).toContain("agent");
    expect(sidecar.registry.list()).toContain("workspace");
    expect(sidecar.registry.list()).toContain("history");
  });

  it("round-trips an agent provider read end-to-end", async () => {
    const client = await connect();
    const agent = createAgentProxy(client);
    const sessions = await agent.listSessions();
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]).toHaveProperty("id");
    client.close();
  });

  it("serves the same data the in-process mock returns (parity)", async () => {
    const { mockAgentProvider } = await import("@/mocks");
    const client = await connect();
    const agent = createAgentProxy(client);
    const viaIpc = await agent.listSessions();
    const direct = await mockAgentProvider.listSessions();
    expect(viaIpc).toEqual(direct);
    client.close();
  });

  it("streams session events through subscribe → done", async () => {
    const client = await connect();
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
    expect(events.length).toBeGreaterThan(0);
    expect(events.at(-1)).toEqual({ type: "done" });
    client.close();
  });

  it("tears down server-side subscriptions when the client disconnects", async () => {
    const client = await connect();
    const agent = createAgentProxy(client);
    // Subscribe to a session whose stream does not immediately complete.
    agent.subscribe("s2", () => {});
    // Let the async subscribe round-trip land.
    await new Promise((r) => setTimeout(r, 30));
    client.close();
    // Allow the close event to propagate to the server connection.
    await new Promise((r) => setTimeout(r, 30));
    expect(sidecar.connectionCount).toBe(0);
  });

  it("surfaces an unknown-method call as a rejected promise", async () => {
    const client = await connect();
    await expect(client.call("agent", "noSuchMethod")).rejects.toThrow(/no method/i);
    client.close();
  });

  it("surfaces an unknown-provider call as a rejected promise", async () => {
    const client = await connect();
    await expect(client.call("nope", "x")).rejects.toThrow(/Unknown provider/);
    client.close();
  });

  it("supports reconnect: a fresh client works after the prior one closed", async () => {
    const first = await connect();
    const a1 = createAgentProxy(first);
    expect((await a1.listSessions()).length).toBeGreaterThan(0);
    first.close();
    await new Promise((r) => setTimeout(r, 20));

    const second = await connect();
    const a2 = createAgentProxy(second);
    expect((await a2.listSessions()).length).toBeGreaterThan(0);
    second.close();
  });

  it("handles many concurrent clients on one sidecar", async () => {
    const clients = await Promise.all(Array.from({ length: 8 }, () => connect()));
    const results = await Promise.all(
      clients.map((c) => createAgentProxy(c).listSessions()),
    );
    expect(results.every((r) => r.length > 0)).toBe(true);
    for (const c of clients) c.close();
  });
});
