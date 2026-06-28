import { describe, expect, it } from "vitest";

import { ProcessSupervisor, type SupervisedHandle } from "../supervisor/process-supervisor.ts";
import { PtyHost } from "../runtime/pty-host.ts";
import type { TerminalEvent } from "@/contracts";

/**
 * road-to-actually-works P6 — PtyHost provider behaviour, hermetic.
 *
 * Drives the host against a fake PTY backend injected through a supervisor's
 * `spawnFn` (no real shell): open → data/exit fan-out, write/resize forwarding,
 * close/list/subscribe. The real shell path is covered by pty-live.int.test.ts.
 */
class FakePty implements SupervisedHandle {
  pid: number | undefined = 9001;
  #alive = true;
  readonly #data: ((c: string) => void)[] = [];
  readonly #exit: ((code: number | null, signal: NodeJS.Signals | null) => void)[] = [];
  readonly written: string[] = [];
  readonly resized: { cols: number; rows: number }[] = [];
  get alive(): boolean {
    return this.#alive;
  }
  onStdout(l: (chunk: string) => void): void {
    this.#data.push(l);
  }
  onStderr(): void {}
  onExit(l: (code: number | null, signal: NodeJS.Signals | null) => void): void {
    this.#exit.push(l);
  }
  onError(): void {}
  write(c: string): void {
    this.written.push(c);
  }
  kill(signal: NodeJS.Signals = "SIGTERM"): void {
    if (!this.#alive) return;
    this.#alive = false;
    for (const f of this.#exit) f(null, signal);
  }
  resize(cols: number, rows: number): void {
    this.resized.push({ cols, rows });
  }
  emitData(c: string): void {
    for (const f of this.#data) f(c);
  }
  exit(code: number): void {
    this.#alive = false;
    for (const f of this.#exit) f(code, null);
  }
}

function hostWithFakes(): { host: PtyHost; ptys: FakePty[] } {
  const ptys: FakePty[] = [];
  const sup = new ProcessSupervisor({
    spawnFn: () => {
      const pty = new FakePty();
      ptys.push(pty);
      return pty;
    },
  });
  return { host: new PtyHost({ supervisor: sup }), ptys };
}

describe("PtyHost (P6 terminal provider)", () => {
  it("open() starts a terminal and reports it in list()", async () => {
    const { host } = hostWithFakes();
    const info = await host.open({ id: "term-1", cwd: "/repo", cols: 100, rows: 30 });
    expect(info).toEqual({ id: "term-1", state: "running", pid: 9001 });

    const list = await host.list();
    expect(list).toEqual([{ id: "term-1", state: "running", pid: 9001 }]);
  });

  it("streams merged output to subscribers as data events", async () => {
    const { host, ptys } = hostWithFakes();
    const events: TerminalEvent[] = [];
    host.subscribe((e) => events.push(e));
    await host.open({ id: "term-1", cwd: "/repo" });

    ptys[0].emitData("$ ls\r\n");
    expect(events).toEqual([{ id: "term-1", kind: "data", data: "$ ls\r\n" }]);
  });

  it("forwards write() (keystrokes) and resize() to the backend", async () => {
    const { host, ptys } = hostWithFakes();
    await host.open({ id: "term-1", cwd: "/repo" });

    await host.write("term-1", "echo hi\n");
    expect(ptys[0].written).toEqual(["echo hi\n"]);

    await host.resize("term-1", 120, 40);
    expect(ptys[0].resized).toEqual([{ cols: 120, rows: 40 }]);
  });

  it("emits an exit event when the shell exits", async () => {
    const { host, ptys } = hostWithFakes();
    const events: TerminalEvent[] = [];
    host.subscribe((e) => events.push(e));
    await host.open({ id: "term-1", cwd: "/repo" });

    ptys[0].exit(0);
    expect(events).toContainEqual({ id: "term-1", kind: "exit", exitCode: 0, signal: null });
  });

  it("close() reaps the terminal and drops it from list()", async () => {
    const { host, ptys } = hostWithFakes();
    await host.open({ id: "term-1", cwd: "/repo" });
    await host.close("term-1");

    expect(ptys[0].alive).toBe(false);
    expect(await host.list()).toEqual([]);
  });

  it("routes multiple terminals independently by id", async () => {
    const { host, ptys } = hostWithFakes();
    const events: TerminalEvent[] = [];
    host.subscribe((e) => events.push(e));
    await host.open({ id: "a", cwd: "/repo" });
    await host.open({ id: "b", cwd: "/repo" });

    ptys[1].emitData("from-b");
    await host.write("a", "to-a");

    expect(events).toContainEqual({ id: "b", kind: "data", data: "from-b" });
    expect(ptys[0].written).toEqual(["to-a"]);
    expect(ptys[1].written).toEqual([]);
  });

  it("unsubscribe stops delivery; a throwing subscriber is isolated", async () => {
    const { host, ptys } = hostWithFakes();
    const got: string[] = [];
    host.subscribe(() => {
      throw new Error("boom");
    });
    const off = host.subscribe((e) => {
      if (e.kind === "data") got.push(e.data);
    });
    await host.open({ id: "a", cwd: "/repo" });

    ptys[0].emitData("x");
    expect(got).toEqual(["x"]);

    off();
    ptys[0].emitData("y");
    expect(got).toEqual(["x"]); // no further delivery
  });
});
