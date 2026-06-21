import { describe, expect, it } from "vitest";
import { NdjsonDecoder, decodeLine, encodeLine } from "@/lib/sidecar/protocol/ndjson.ts";
import { JSONRPC_VERSION, type RpcRequest } from "@/lib/sidecar/protocol/jsonrpc.ts";

describe("NDJSON framing", () => {
  const req: RpcRequest = { jsonrpc: JSONRPC_VERSION, id: 1, method: "a.b", params: [1, 2] };

  it("round-trips a message through encode → decode", () => {
    const line = encodeLine(req);
    expect(line.endsWith("\n")).toBe(true);
    const r = decodeLine(line.trimEnd());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.message).toEqual(req);
  });

  it("yields whole lines and holds a trailing partial across chunks", () => {
    const dec = new NdjsonDecoder();
    const full = encodeLine(req);
    const mid = Math.floor(full.length / 2);
    // Split a single message across two arbitrary chunk boundaries.
    const first = dec.push(full.slice(0, mid));
    expect(first).toHaveLength(0);
    expect(dec.pending).toBe(mid);
    const second = dec.push(full.slice(mid));
    expect(second).toHaveLength(1);
    expect(dec.pending).toBe(0);
    expect(second[0].ok).toBe(true);
  });

  it("emits multiple messages packed into one chunk", () => {
    const dec = new NdjsonDecoder();
    const chunk = encodeLine(req) + encodeLine({ ...req, id: 2 }) + encodeLine({ ...req, id: 3 });
    const out = dec.push(chunk);
    expect(out).toHaveLength(3);
    expect(out.every((r) => r.ok)).toBe(true);
  });

  it("skips blank/keep-alive lines without surfacing a parse error", () => {
    const dec = new NdjsonDecoder();
    const out = dec.push("\n\n" + encodeLine(req) + "\n");
    expect(out).toHaveLength(1);
    expect(out[0].ok).toBe(true);
  });

  it("returns a structured error for a malformed JSON line (never throws)", () => {
    const dec = new NdjsonDecoder();
    const out = dec.push("{not json}\n");
    expect(out).toHaveLength(1);
    expect(out[0].ok).toBe(false);
    if (!out[0].ok) expect(out[0].error).toBeInstanceOf(Error);
  });

  it("rejects a non-object JSON line", () => {
    const out = decodeLine("42");
    expect(out.ok).toBe(false);
  });

  it("throws when a single un-terminated line exceeds the byte cap (runaway peer)", () => {
    const dec = new NdjsonDecoder(64);
    expect(() => dec.push("x".repeat(128))).toThrow(/exceeded 64 bytes/);
  });

  it("handles a flood of small chunks (backpressure / fragmentation)", () => {
    const dec = new NdjsonDecoder();
    const messages = Array.from({ length: 200 }, (_, i) => ({ ...req, id: i + 1 }));
    const wire = messages.map(encodeLine).join("");
    // Feed one byte at a time — the worst-case fragmentation a socket can do.
    const seen: number[] = [];
    for (const ch of wire) {
      for (const r of dec.push(ch)) {
        if (r.ok) seen.push((r.message as RpcRequest).id);
      }
    }
    expect(seen).toEqual(messages.map((m) => m.id));
    expect(dec.pending).toBe(0);
  });
});
