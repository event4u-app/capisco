import { describe, expect, it, vi } from "vitest";

import { createTerminalProxy } from "./terminal-proxy.ts";
import type { SidecarClient } from "./sidecar-client.ts";
import type { TerminalEvent } from "@/contracts";

/**
 * road-to-actually-works P6 — the IPC terminal proxy routes every method to the
 * client correctly: commands → `call(terminal, …)`, subscribe → the streaming
 * `client.subscribe(terminal, id, …)` channel. Mirrors the agent-proxy contract.
 */
function fakeClient() {
  const calls: { method: string; args: unknown[] }[] = [];
  const subs: { provider: string; targetId: string; listener: (e: unknown) => void }[] = [];
  const offs: ReturnType<typeof vi.fn>[] = [];
  const client = {
    call: vi.fn((_provider: string, method: string, args: unknown[]) => {
      calls.push({ method, args });
      return Promise.resolve(undefined);
    }),
    subscribe: vi.fn((provider: string, targetId: string, listener: (e: unknown) => void) => {
      subs.push({ provider, targetId, listener });
      const off = vi.fn();
      offs.push(off);
      return Promise.resolve(off);
    }),
  } as unknown as SidecarClient;
  return { client, calls, subs, offs };
}

describe("createTerminalProxy", () => {
  it("routes open/write/resize/close/list to client.call on the terminal provider", async () => {
    const { client, calls } = fakeClient();
    const term = createTerminalProxy(client);

    await term.open({ id: "t1", cwd: "/repo", cols: 100, rows: 30 });
    await term.write("t1", "ls\n");
    await term.resize("t1", 120, 40);
    await term.close("t1");
    await term.list();

    expect(client.call).toHaveBeenCalledWith("terminal", "open", [
      { id: "t1", cwd: "/repo", cols: 100, rows: 30 },
    ]);
    expect(calls.map((c) => c.method)).toEqual(["open", "write", "resize", "close", "list"]);
    expect(calls[1].args).toEqual(["t1", "ls\n"]);
    expect(calls[2].args).toEqual(["t1", 120, 40]);
  });

  it("subscribe opens the per-id IPC stream and forwards events to the listener", async () => {
    const { client, subs } = fakeClient();
    const term = createTerminalProxy(client);
    const events: TerminalEvent[] = [];

    term.subscribe("t1", (e) => events.push(e));
    await Promise.resolve(); // let the background subscribe open

    expect(client.subscribe).toHaveBeenCalledWith("terminal", "t1", expect.any(Function));
    subs[0].listener({ id: "t1", kind: "data", data: "hi" });
    expect(events).toEqual([{ id: "t1", kind: "data", data: "hi" }]);
  });

  it("unsubscribe tears down the server stream once it has opened", async () => {
    const { client, offs } = fakeClient();
    const term = createTerminalProxy(client);

    const off = term.subscribe("t1", () => {});
    await Promise.resolve(); // stream opens, teardown captured
    off();

    expect(offs[0]).toHaveBeenCalledTimes(1);
  });
});
