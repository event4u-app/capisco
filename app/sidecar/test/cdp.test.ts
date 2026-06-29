import { describe, expect, it } from "vitest";

import { CdpClient, NodeDebugSession, type CdpChannel } from "../runtime/cdp.ts";

/**
 * road-to-real-runtime P1 — pure CDP codec + session (no inspector/WebSocket).
 * The injected channel mirrors what Node's V8 inspector sends; the live leg is
 * cdp.int.test.ts. Verifies request/response matching, event dispatch, the
 * entry-pause skip, breakpoint framing, and locals parsing.
 */
class FakeChannel implements CdpChannel {
  readonly sent: Array<{ id: number; method: string; params: unknown }> = [];
  #onMsg: ((d: string) => void) | undefined;
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  onMessage(cb: (d: string) => void): void {
    this.#onMsg = cb;
  }
  onClose(): void {}
  close(): void {}
  emit(obj: unknown): void {
    this.#onMsg?.(JSON.stringify(obj));
  }
  /** Reply to the Nth sent request (by index) with a result. */
  reply(index: number, result: unknown): void {
    this.emit({ id: this.sent[index].id, result });
  }
  last(): { id: number; method: string; params: unknown } {
    return this.sent[this.sent.length - 1];
  }
}

describe("CdpClient (pure protocol)", () => {
  it("matches a response to its request id", async () => {
    const ch = new FakeChannel();
    const cdp = new CdpClient(ch);
    const p = cdp.send<{ debuggerId: string }>("Debugger.enable");
    expect(ch.last().method).toBe("Debugger.enable");
    ch.reply(0, { debuggerId: "x1" });
    await expect(p).resolves.toEqual({ debuggerId: "x1" });
  });

  it("rejects on a CDP error", async () => {
    const ch = new FakeChannel();
    const cdp = new CdpClient(ch);
    const p = cdp.send("Debugger.foo");
    ch.emit({ id: ch.last().id, error: { message: "no such method" } });
    await expect(p).rejects.toThrow(/no such method/);
  });

  it("dispatches events to listeners", () => {
    const ch = new FakeChannel();
    const cdp = new CdpClient(ch);
    const seen: unknown[] = [];
    cdp.on("Debugger.paused", (p) => seen.push(p));
    ch.emit({ method: "Debugger.paused", params: { reason: "other" } });
    expect(seen).toEqual([{ reason: "other" }]);
  });
});

describe("NodeDebugSession (pure)", () => {
  it("frames setBreakpointByUrl with a 0-based line + anchored url regex", async () => {
    const ch = new FakeChannel();
    const session = new NodeDebugSession(new CdpClient(ch));
    const p = session.setBreakpoint("/repo/src/app.js", 5); // 1-based
    ch.reply(ch.sent.length - 1, { breakpointId: "1", locations: [] });
    await p;
    const req = ch.sent.find((s) => s.method === "Debugger.setBreakpointByUrl");
    expect((req?.params as { lineNumber: number }).lineNumber).toBe(4); // 0-based
    expect((req?.params as { urlRegex: string }).urlRegex).toMatch(/app\\\.js\$$/);
  });

  it("skips the entry (break-on-start) pause, then surfaces the breakpoint pause", async () => {
    const ch = new FakeChannel();
    const session = new NodeDebugSession(new CdpClient(ch));

    // Entry pause (break-on-start) → auto-resumed, NOT surfaced.
    ch.emit({ method: "Debugger.paused", params: { reason: "Break on start", callFrames: [{ functionName: "", location: { lineNumber: 0 } }] } });
    expect(ch.sent.some((s) => s.method === "Debugger.resume")).toBe(true);

    // The real breakpoint pause inside add → surfaced with 1-based line + scope id.
    const waiting = session.waitForPause();
    ch.emit({
      method: "Debugger.paused",
      params: {
        reason: "other",
        callFrames: [
          {
            functionName: "add",
            url: "file:///repo/src/app.js",
            location: { lineNumber: 4 },
            scopeChain: [{ type: "local", object: { objectId: "obj-1" } }],
          },
        ],
      },
    });
    const pause = await waiting;
    expect(pause.topFrame).toMatchObject({ functionName: "add", line: 5, localScopeObjectId: "obj-1" });
  });

  it("reads locals via Runtime.getProperties", async () => {
    const ch = new FakeChannel();
    const session = new NodeDebugSession(new CdpClient(ch));
    const p = session.locals({ reason: "other", topFrame: { functionName: "add", url: "", line: 5, localScopeObjectId: "obj-1" } });
    const req = ch.last();
    expect(req.method).toBe("Runtime.getProperties");
    ch.emit({
      id: req.id,
      result: { result: [{ name: "a", value: { value: 1, type: "number" } }, { name: "b", value: { value: 2, type: "number" } }] },
    });
    await expect(p).resolves.toEqual({ a: "1", b: "2" });
  });
});
