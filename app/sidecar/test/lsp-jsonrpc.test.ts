import { describe, expect, it } from "vitest";

import { LspDecoder, encode } from "../lsp/lsp-jsonrpc.ts";

describe("LSP JSON-RPC framing", () => {
  it("encode produces a Content-Length header + body", () => {
    const framed = encode({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(framed).toMatch(/^Content-Length: \d+\r\n\r\n/);
    const body = framed.split("\r\n\r\n")[1];
    expect(JSON.parse(body)).toEqual({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  });

  it("decodes a single complete message", () => {
    const d = new LspDecoder();
    const msgs = d.push(encode({ jsonrpc: "2.0", id: 1, result: { ok: true } }));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].result).toEqual({ ok: true });
  });

  it("decodes several messages arriving in one chunk", () => {
    const d = new LspDecoder();
    const chunk = encode({ jsonrpc: "2.0", id: 1, result: 1 }) + encode({ jsonrpc: "2.0", id: 2, result: 2 });
    const msgs = d.push(chunk);
    expect(msgs.map((m) => m.id)).toEqual([1, 2]);
  });

  it("buffers a message split across chunks (partial header, partial body)", () => {
    const d = new LspDecoder();
    const full = encode({ jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri: "x" } });
    const mid = Math.floor(full.length / 2);
    expect(d.push(full.slice(0, mid))).toEqual([]); // nothing complete yet
    const msgs = d.push(full.slice(mid));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].method).toBe("textDocument/publishDiagnostics");
  });

  it("keeps trailing bytes of the next message buffered", () => {
    const d = new LspDecoder();
    const a = encode({ jsonrpc: "2.0", id: 1, result: "a" });
    const b = encode({ jsonrpc: "2.0", id: 2, result: "b" });
    const msgs = d.push(a + b.slice(0, 10)); // all of a + partial b
    expect(msgs.map((m) => m.id)).toEqual([1]);
    const rest = d.push(b.slice(10));
    expect(rest.map((m) => m.id)).toEqual([2]);
  });
});
