import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ProcessSupervisor,
  wrapChildProcess,
  type SpawnFn,
  type SupervisedHandle,
} from "../supervisor/process-supervisor.ts";

/**
 * road-to-actually-works P6, Option C (staged) — Phase 1 conformance.
 *
 * Proves the supervisor drives a backend that is NOT a Node `ChildProcess`:
 * a PTY-shaped {@link SupervisedHandle} with one merged data stream (no stderr,
 * no `setEncoding`, no EventEmitter `.on`) plus `resize`. This is the exact
 * contract the node-pty wrapper will satisfy in Phase 2 — verified here behind
 * the interface, before the native dep lands (fake-behind-contract doctrine).
 */
class FakePty implements SupervisedHandle {
  pid: number | undefined = 4242;
  #alive = true;
  readonly #data: ((c: string) => void)[] = [];
  readonly #exit: ((code: number | null, signal: NodeJS.Signals | null) => void)[] = [];
  readonly written: string[] = [];
  readonly resized: { cols: number; rows: number }[] = [];
  stderrWired = false;

  get alive(): boolean {
    return this.#alive;
  }
  onStdout(listener: (chunk: string) => void): void {
    this.#data.push(listener);
  }
  onStderr(_listener: (chunk: string) => void): void {
    // A PTY merges everything into the data stream — wiring is a no-op, and no
    // stderr is ever synthesized. The flag lets the test assert it never fires.
    this.stderrWired = true;
  }
  onExit(listener: (code: number | null, signal: NodeJS.Signals | null) => void): void {
    this.#exit.push(listener);
  }
  onError(_listener: (err: Error) => void): void {
    /* a PTY has no separate error channel in this fake */
  }
  write(chunk: string): void {
    this.written.push(chunk);
  }
  kill(signal: NodeJS.Signals = "SIGTERM"): void {
    if (!this.#alive) return;
    this.#alive = false;
    for (const f of this.#exit) f(null, signal);
  }
  resize(cols: number, rows: number): void {
    this.resized.push({ cols, rows });
  }

  // ---- test drivers ----
  emitData(chunk: string): void {
    for (const f of this.#data) f(chunk);
  }
  crash(code: number): void {
    if (!this.#alive) return;
    this.#alive = false;
    for (const f of this.#exit) f(code, null);
  }
}

function ptyTracker(): { spawnFn: SpawnFn; ptys: FakePty[] } {
  const ptys: FakePty[] = [];
  const spawnFn: SpawnFn = () => {
    const pty = new FakePty();
    ptys.push(pty);
    return pty;
  };
  return { spawnFn, ptys };
}

describe("SupervisedHandle — PTY-shaped backend (P6 Phase 1 conformance)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("drives a non-ChildProcess handle: running, merged output, stdin write", () => {
    const { spawnFn, ptys } = ptyTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    const out: string[] = [];
    const err: string[] = [];
    const proc = sup.spawn(
      { id: "pty:term-1", command: "bash", args: ["-l"] },
      { onStdout: (c) => out.push(c), onStderr: (c) => err.push(c) },
    );

    expect(proc.state).toBe("running");
    expect(proc.pid).toBe(4242);

    ptys[0].emitData("$ ls\r\n");
    expect(out).toEqual(["$ ls\r\n"]);
    // A PTY never produces stderr — the merged stream is the only output.
    expect(err).toEqual([]);

    proc.write("ls\n");
    expect(ptys[0].written).toEqual(["ls\n"]);
  });

  it("restarts a crashed PTY with backoff, exactly like a child process", () => {
    const { spawnFn, ptys } = ptyTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    const proc = sup.spawn({
      id: "pty:term-1",
      command: "bash",
      restart: { mode: "on-crash", maxRestarts: 1, baseDelayMs: 100, maxDelayMs: 1000 },
    });

    ptys[0].crash(1);
    expect(proc.state).toBe("restarting");
    vi.advanceTimersByTime(100);
    expect(proc.state).toBe("running");
    expect(proc.restarts).toBe(1);
    expect(ptys).toHaveLength(2);

    // At maxRestarts → next crash gives up.
    ptys[1].crash(1);
    expect(proc.state).toBe("exited");
    expect(ptys).toHaveLength(2);
  });

  it("kill() reaps a PTY and is not mistaken for a crash-restart", () => {
    const { spawnFn, ptys } = ptyTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    const proc = sup.spawn({ id: "pty:term-1", command: "bash", restart: "on-crash" });

    proc.kill();
    expect(proc.state).toBe("killed");
    vi.advanceTimersByTime(10_000);
    expect(ptys).toHaveLength(1); // no restart
    expect(sup.size).toBe(0);
  });

  it("idle-reaps a quiet PTY; data resets the idle timer", () => {
    const { spawnFn, ptys } = ptyTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    const proc = sup.spawn({
      id: "pty:idle",
      command: "bash",
      idleTimeoutMs: 1000,
      restart: "never",
    });

    vi.advanceTimersByTime(900);
    ptys[0].emitData("tick"); // activity → timer resets
    vi.advanceTimersByTime(900);
    expect(proc.state).toBe("running");

    vi.advanceTimersByTime(1000); // now quiet past the timeout
    expect(proc.state).toBe("killed");
  });

  it("exposes resize on the PTY handle (consumed by the Phase 2 PTY host)", () => {
    const { spawnFn, ptys } = ptyTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    sup.spawn({ id: "pty:term-1", command: "bash" });

    // The handle carries resize; a child-process handle does not.
    expect(typeof ptys[0].resize).toBe("function");
    ptys[0].resize(120, 40);
    expect(ptys[0].resized).toEqual([{ cols: 120, rows: 40 }]);
  });

  it("SupervisedProcess.resize() forwards to the PTY handle", () => {
    const { spawnFn, ptys } = ptyTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    const proc = sup.spawn({ id: "pty:term-1", command: "bash" });

    proc.resize(132, 43);
    expect(ptys[0].resized).toEqual([{ cols: 132, rows: 43 }]);
  });
});

describe("SupervisedProcess.resize — stdio backend is a no-op", () => {
  it("does not throw when the handle has no resize (ChildProcess backend)", () => {
    // A ChildProcess-shaped fake (no resize) — resize must be silently ignored.
    class StdioFake {
      pid: number | undefined = 7;
      exitCode: number | null = null;
      signalCode: NodeJS.Signals | null = null;
      stdin = { write: () => {} };
      stdout = { setEncoding: () => {}, on: () => {} };
      stderr = { setEncoding: () => {}, on: () => {} };
      on(): void {}
      kill(): boolean {
        return true;
      }
    }
    const sup = new ProcessSupervisor({ spawnFn: (() => new StdioFake()) as unknown as SpawnFn });
    const proc = sup.spawn({ id: "lsp:ts", command: "tsserver", restart: "never" });
    expect(() => proc.resize(80, 24)).not.toThrow();
  });
});

describe("wrapChildProcess — child-process handle has no resize", () => {
  it("omits resize (only a PTY backend resizes)", () => {
    // Minimal ChildProcess-shaped stub: enough surface for wrapChildProcess.
    const stub = {
      pid: 1,
      exitCode: null as number | null,
      signalCode: null as NodeJS.Signals | null,
      stdin: { write: () => {} },
      stdout: { setEncoding: () => {}, on: () => {} },
      stderr: { setEncoding: () => {}, on: () => {} },
      on: () => {},
      kill: () => true,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = wrapChildProcess(stub as any);
    expect(handle.resize).toBeUndefined();
    expect(handle.alive).toBe(true);
    expect(handle.pid).toBe(1);
  });
});
