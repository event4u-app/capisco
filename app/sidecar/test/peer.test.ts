import { describe, expect, it, vi } from "vitest";
import { RpcClientPeer, RpcServerPeer } from "@/lib/sidecar/protocol/peer.ts";
import { createPipePair } from "@/lib/sidecar/protocol/transport.ts";
import { RpcErrorCode } from "@/lib/sidecar/protocol/jsonrpc.ts";

function wired() {
  const { a, b } = createPipePair();
  const handlers = new Map<string, (params: unknown) => unknown>();
  const server = new RpcServerPeer(b, (method, params) => {
    const h = handlers.get(method);
    if (!h) throw new Error(`no handler ${method}`);
    return h(params);
  });
  const client = new RpcClientPeer(a);
  return { client, server, handlers, a, b };
}

describe("RPC peer round-trip", () => {
  it("correlates a response to its request", async () => {
    const { client, handlers } = wired();
    handlers.set("sum", (p) => (p as number[]).reduce((x, y) => x + y, 0));
    await expect(client.request("sum", [1, 2, 3])).resolves.toBe(6);
    expect(client.inFlight).toBe(0);
  });

  it("keeps concurrent requests independent (out-of-order resolution)", async () => {
    const { client, handlers } = wired();
    handlers.set("echo", async (p) => {
      const { v, delay } = p as { v: number; delay: number };
      await new Promise((r) => setTimeout(r, delay));
      return v;
    });
    const slow = client.request("echo", { v: 1, delay: 20 });
    const fast = client.request("echo", { v: 2, delay: 0 });
    expect(await fast).toBe(2);
    expect(await slow).toBe(1);
  });

  it("surfaces a thrown handler as a structured ProviderError", async () => {
    const { client, handlers } = wired();
    handlers.set("boom", () => {
      throw new Error("kaboom");
    });
    await expect(client.request("boom")).rejects.toMatchObject({
      message: "kaboom",
      code: RpcErrorCode.ProviderError,
    });
  });

  it("delivers server-pushed events to a channel listener", () => {
    const { client, server } = wired();
    const seen: unknown[] = [];
    const off = client.on("session:s1", (e) => seen.push(e));
    server.pushEvent("session:s1", { type: "token", delta: "a" });
    server.pushEvent("session:s2", { type: "token", delta: "ignored" });
    server.pushEvent("session:s1", { type: "done" });
    off();
    server.pushEvent("session:s1", { type: "token", delta: "after-off" });
    expect(seen).toEqual([
      { type: "token", delta: "a" },
      { type: "done" },
    ]);
  });

  it("rejects all in-flight requests when the transport closes (reconnect path)", async () => {
    const { client, a } = wired();
    const never = client.request("hangs-forever");
    a.close();
    await expect(never).rejects.toThrow();
    expect(client.inFlight).toBe(0);
  });

  it("rejects a request issued on a closed transport", async () => {
    const { client, a } = wired();
    a.close();
    await expect(client.request("x")).rejects.toThrow(/closed/);
  });

  it("ignores malformed inbound lines without crashing the peer", async () => {
    const { client, handlers, b } = wired();
    handlers.set("ok", () => "fine");
    // Inject a garbage line directly onto the client's transport input.
    const onData = vi.fn();
    void onData;
    b.send("{garbage\n");
    await expect(client.request("ok")).resolves.toBe("fine");
  });
});
