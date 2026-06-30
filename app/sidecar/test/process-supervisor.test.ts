import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ProcessSupervisor,
  sealedEnv,
  type SpawnFn,
  type SupervisedSpec,
} from "../supervisor/process-supervisor.ts";

/**
 * Deterministic fake child: an EventEmitter that looks enough like a
 * ChildProcessByStdio for the supervisor (stdin.write, stdout/stderr streams,
 * exit/error events, kill). No real OS process — the lifecycle logic is tested
 * in isolation with fake timers (road-to-actually-works P1, verification spine).
 */
class FakeChild extends EventEmitter {
  pid = Math.floor(Math.random() * 1e6) + 1;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  stdin = { written: [] as string[], write: (c: string) => void this.stdin.written.push(c) };
  stdout = new EventEmitter() as EventEmitter & { setEncoding: (e: string) => void };
  stderr = new EventEmitter() as EventEmitter & { setEncoding: (e: string) => void };

  constructor() {
    super();
    this.stdout.setEncoding = () => {};
    this.stderr.setEncoding = () => {};
  }
  emitStdout(chunk: string): void {
    this.stdout.emit("data", chunk);
  }
  emitStderr(chunk: string): void {
    this.stderr.emit("data", chunk);
  }
  /** Simulate the OS process exiting. */
  exit(code: number | null, signal: NodeJS.Signals | null = null): void {
    this.exitCode = code;
    this.signalCode = signal;
    this.emit("exit", code, signal);
  }
  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    // Mirror node: killing delivers the signal, then the process exits.
    this.exit(null, signal);
    return true;
  }
}

function spawnTracker(): { spawnFn: SpawnFn; children: FakeChild[]; specs: SupervisedSpec[] } {
  const children: FakeChild[] = [];
  const specs: SupervisedSpec[] = [];
  const spawnFn: SpawnFn = (spec) => {
    specs.push(spec);
    const child = new FakeChild();
    children.push(child);
    return child as never;
  };
  return { spawnFn, children, specs };
}

describe("sealedEnv", () => {
  it("carries only the allowlist, never arbitrary secrets", () => {
    const env = sealedEnv({ PATH: "/bin", HOME: "/h", SECRET_TOKEN: "sk-leak", AWS_KEY: "x" });
    expect(env.PATH).toBe("/bin");
    expect(env.HOME).toBe("/h");
    expect(env.SECRET_TOKEN).toBeUndefined();
    expect(env.AWS_KEY).toBeUndefined();
  });
});

describe("ProcessSupervisor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("spawns and reaches running, captures stdout, writes stdin", () => {
    const { spawnFn, children } = spawnTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    const out: string[] = [];
    const proc = sup.spawn(
      { id: "pty:1", command: "bash", args: ["-l"] },
      { onStdout: (c) => out.push(c) },
    );
    expect(proc.state).toBe("running");
    expect(sup.size).toBe(1);

    children[0].emitStdout("hello\n");
    expect(out).toEqual(["hello\n"]);

    proc.write("ls\n");
    expect(children[0].stdin.written).toEqual(["ls\n"]);
  });

  it("restarts on crash with exponential backoff, capped at maxRestarts", () => {
    const { spawnFn, children } = spawnTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    const states: string[] = [];
    const proc = sup.spawn(
      {
        id: "lsp:ts",
        command: "tsserver",
        restart: { mode: "on-crash", maxRestarts: 2, baseDelayMs: 100, maxDelayMs: 1000 },
      },
      { onState: (s) => states.push(s) },
    );

    // Crash 1 → restarting → (100ms) → running again.
    children[0].exit(1);
    expect(proc.state).toBe("restarting");
    vi.advanceTimersByTime(100);
    expect(proc.state).toBe("running");
    expect(proc.restarts).toBe(1);
    expect(children).toHaveLength(2);

    // Crash 2 → backoff doubles to 200ms → running.
    children[1].exit(1);
    vi.advanceTimersByTime(200);
    expect(proc.state).toBe("running");
    expect(proc.restarts).toBe(2);
    expect(children).toHaveLength(3);

    // Crash 3 → at maxRestarts → gives up → exited (no 4th child).
    children[2].exit(1);
    expect(proc.state).toBe("exited");
    expect(children).toHaveLength(3);
    expect(sup.size).toBe(0);
  });

  it("does NOT restart on clean exit (code 0)", () => {
    const { spawnFn, children } = spawnTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    const proc = sup.spawn({ id: "once", command: "true", restart: "on-crash" });
    children[0].exit(0);
    expect(proc.state).toBe("exited");
    expect(children).toHaveLength(1);
    expect(sup.size).toBe(0);
  });

  it("reaps an idle process after the idle timeout", () => {
    const { spawnFn, children } = spawnTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    const proc = sup.spawn({ id: "pty:idle", command: "bash", idleTimeoutMs: 1000, restart: "never" });
    expect(proc.state).toBe("running");

    // Activity resets the timer: at 900ms output arrives, so it should survive past 1000ms.
    vi.advanceTimersByTime(900);
    children[0].emitStdout("tick");
    vi.advanceTimersByTime(900);
    expect(proc.state).toBe("running");

    // Now go quiet past the timeout → reaped.
    vi.advanceTimersByTime(1000);
    expect(proc.state).toBe("killed");
    expect(sup.size).toBe(0);
  });

  it("enforces the concurrency cap", () => {
    const { spawnFn } = spawnTracker();
    const sup = new ProcessSupervisor({ spawnFn, maxProcesses: 2 });
    sup.spawn({ id: "a", command: "x", restart: "never" });
    sup.spawn({ id: "b", command: "x", restart: "never" });
    expect(() => sup.spawn({ id: "c", command: "x" })).toThrow(/capacity/);
  });

  it("replacing an id kills the previous process", () => {
    const { spawnFn, children } = spawnTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    const first = sup.spawn({ id: "dap:php", command: "x", restart: "never" });
    sup.spawn({ id: "dap:php", command: "y", restart: "never" });
    expect(first.state).toBe("killed");
    expect(children).toHaveLength(2);
    expect(sup.size).toBe(1);
  });

  it("killAll reaps every supervised process", () => {
    const { spawnFn } = spawnTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    sup.spawn({ id: "1", command: "x", restart: "never" });
    sup.spawn({ id: "2", command: "x", restart: "never" });
    expect(sup.size).toBe(2);
    sup.killAll();
    expect(sup.size).toBe(0);
  });

  it("a killed process does not auto-restart even with on-crash policy", () => {
    const { spawnFn, children } = spawnTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    const proc = sup.spawn({ id: "k", command: "x", restart: "on-crash" });
    proc.kill();
    // kill() drives the fake child to exit with a signal; must NOT be read as a crash-restart.
    expect(proc.state).toBe("killed");
    vi.advanceTimersByTime(10_000);
    expect(children).toHaveLength(1);
    expect(sup.size).toBe(0);
  });
});

describe("ProcessSupervisor — health introspection (P3 observability)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("health() reports id / state / restarts for every supervised process", () => {
    const { spawnFn } = spawnTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    sup.spawn({ id: "lsp:ts", command: "tsserver", restart: "never" });
    sup.spawn({ id: "pty:1", command: "bash", restart: "never" });

    const health = sup.health();
    expect(health.map((h) => h.id).sort()).toEqual(["lsp:ts", "pty:1"]);
    expect(health.every((h) => h.state === "running")).toBe(true);
    expect(health.every((h) => h.restarts === 0)).toBe(true);
  });

  it("subscribe fires a fresh snapshot on spawn, state change, and reap", () => {
    const { spawnFn, children } = spawnTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    const snapshots: number[] = [];
    sup.subscribe((h) => snapshots.push(h.length));

    const proc = sup.spawn({
      id: "lsp:ts",
      command: "tsserver",
      restart: { mode: "on-crash", maxRestarts: 2, baseDelayMs: 100, maxDelayMs: 1000 },
    });
    expect(snapshots.at(-1)).toBe(1); // spawned → one running process

    // Crash → restarting (a state transition fires a snapshot).
    children[0].exit(1);
    expect(proc.state).toBe("restarting");
    vi.advanceTimersByTime(100);
    expect(proc.state).toBe("running");
    // The restart bumped the count surfaced in health.
    expect(sup.health()[0].restarts).toBe(1);

    // Reap → the process leaves the snapshot.
    proc.kill();
    expect(snapshots.at(-1)).toBe(0);
  });

  it("unsubscribe stops delivery; a throwing observer is isolated", () => {
    const { spawnFn } = spawnTracker();
    const sup = new ProcessSupervisor({ spawnFn });
    const good: number[] = [];
    sup.subscribe(() => {
      throw new Error("observer blew up");
    });
    const off = sup.subscribe((h) => good.push(h.length));

    sup.spawn({ id: "a", command: "x", restart: "never" }); // both observers fire; throw isolated
    expect(good.at(-1)).toBe(1);

    off();
    sup.spawn({ id: "b", command: "x", restart: "never" });
    expect(good.at(-1)).toBe(1); // unsubscribed — no further delivery
    expect(sup.size).toBe(2); // the supervisor still works despite the throwing observer
  });
});
