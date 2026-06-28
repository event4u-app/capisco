import { describe, expect, it } from "vitest";

import { mockTerminalProvider } from "./terminal.ts";
import type { TerminalEvent } from "@/contracts";

/**
 * road-to-actually-works P6 — the browser-mode terminal mock satisfies the
 * TerminalProvider contract deterministically: open → running + replayed
 * transcript, write → local echo, per-id subscribe routing, close drops it.
 */
describe("mockTerminalProvider", () => {
  it("open() returns a running terminal and lists it", async () => {
    const info = await mockTerminalProvider.open({ id: "m1", cwd: "/repo" });
    expect(info).toMatchObject({ id: "m1", state: "running" });
    expect(typeof info.pid).toBe("number");
    const list = await mockTerminalProvider.list();
    expect(list.some((t) => t.id === "m1")).toBe(true);
    await mockTerminalProvider.close("m1");
  });

  it("replays the transcript to a subscriber after open (subscribe-before-open)", async () => {
    const events: TerminalEvent[] = [];
    const off = mockTerminalProvider.subscribe("m2", (e) => events.push(e));
    await mockTerminalProvider.open({ id: "m2", cwd: "/repo" });
    await new Promise<void>((r) => queueMicrotask(r)); // let the replay flush

    const data = events.filter((e) => e.kind === "data").map((e) => (e.kind === "data" ? e.data : ""));
    expect(data.join("")).toContain("pnpm test core/broker");
    off();
    await mockTerminalProvider.close("m2");
  });

  it("write() echoes locally to the matching terminal only", async () => {
    const a: TerminalEvent[] = [];
    const b: TerminalEvent[] = [];
    const offA = mockTerminalProvider.subscribe("ma", (e) => a.push(e));
    const offB = mockTerminalProvider.subscribe("mb", (e) => b.push(e));
    await mockTerminalProvider.open({ id: "ma", cwd: "/repo" });
    await mockTerminalProvider.open({ id: "mb", cwd: "/repo" });
    await new Promise<void>((r) => queueMicrotask(r));

    a.length = 0;
    b.length = 0;
    await mockTerminalProvider.write("ma", "echo hi\n");
    await new Promise<void>((r) => queueMicrotask(r));

    expect(a.some((e) => e.kind === "data" && e.data === "echo hi\n")).toBe(true);
    expect(b.some((e) => e.kind === "data" && e.data === "echo hi\n")).toBe(false);
    offA();
    offB();
    await mockTerminalProvider.close("ma");
    await mockTerminalProvider.close("mb");
  });

  it("close() drops the terminal from list()", async () => {
    await mockTerminalProvider.open({ id: "mc", cwd: "/repo" });
    await mockTerminalProvider.close("mc");
    const list = await mockTerminalProvider.list();
    expect(list.some((t) => t.id === "mc")).toBe(false);
  });
});
