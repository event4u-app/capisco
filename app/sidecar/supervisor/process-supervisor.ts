/**
 * Sidecar process supervisor (road-to-actually-works P1).
 *
 * THE shared lifecycle primitive for every long-lived child process the sidecar
 * manages: PTY (terminal), LSP servers, container-exec, DAP debug adapters. The
 * council read-through flagged that without this, the same spawn/reap/restart
 * logic gets built four slightly-different times. This is built ONCE; the four
 * consumers spawn through it.
 *
 * What it owns:
 *  - spawn (no shell — discrete argv, sealed env by default)
 *  - reap   (kill + cleanup, idempotent)
 *  - crash-restart with exponential backoff (capped)
 *  - idle-timeout reaping (a process with no activity is killed)
 *  - a concurrency cap (max supervised processes) + per-process output cap
 *
 * It is NOT an RPC provider — it is infrastructure consumed by other sidecar
 * modules. It is unit-tested against an injectable `spawnFn` (a fake child) so
 * the lifecycle logic is deterministic without real OS processes.
 *
 * Posture mirrors git-exec.ts / claude-stream-exec.ts: never through a shell,
 * sealed child env, piped stderr (captured, never inherited).
 */

import { spawn as nodeSpawn } from "node:child_process";
import type { ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";

/** Env keys a supervised child inherits by default. No secrets — see invariant §3.2. */
export const SUPERVISOR_ENV_ALLOWLIST = ["PATH", "HOME", "TMPDIR", "LANG", "SHELL"] as const;

export function sealedEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of SUPERVISOR_ENV_ALLOWLIST) {
    const value = base[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

export type ProcessState = "starting" | "running" | "restarting" | "exited" | "killed";

/** Restart policy. `never` = one shot; `on-crash` = restart on non-zero/unexpected exit. */
export type RestartPolicy =
  | "never"
  | "on-crash"
  | {
      readonly mode: "on-crash";
      /** Max automatic restarts before giving up (then state stays `exited`). */
      readonly maxRestarts: number;
      /** First backoff delay; doubles each restart up to `maxDelayMs`. */
      readonly baseDelayMs: number;
      readonly maxDelayMs: number;
    };

export interface SupervisedSpec {
  /** Stable id, e.g. `pty:term-1`, `lsp:ts:/repo`, `dap:php:9003`. */
  readonly id: string;
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  /** Defaults to a sealed allowlist env. Pass explicitly to widen (never secrets). */
  readonly env?: NodeJS.ProcessEnv;
  readonly restart?: RestartPolicy;
  /** Kill the process if no activity (write or output) for this long. 0 = never. */
  readonly idleTimeoutMs?: number;
  /** Cap captured stdout/stderr ring per stream (bytes). Default 1 MiB. */
  readonly maxOutputBytes?: number;
}

export interface ProcessEvents {
  onState?: (state: ProcessState, info: { restarts: number; pid?: number }) => void;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  /** Fires on every exit (including ones that will trigger a restart). */
  onExit?: (code: number | null, signal: NodeJS.Signals | null, willRestart: boolean) => void;
}

type SpawnedChild = ChildProcessByStdio<Writable, Readable, Readable>;
export type SpawnFn = (spec: SupervisedSpec) => SpawnedChild;

export interface SupervisedProcess {
  readonly id: string;
  readonly state: ProcessState;
  readonly pid: number | undefined;
  readonly restarts: number;
  /** Write to the child's stdin; counts as activity (resets idle timer). */
  write(chunk: string): void;
  /** Reset the idle timer without writing (consumer saw activity, e.g. a read). */
  touch(): void;
  /** Stop supervising: kill, cancel restarts, cancel idle timer. Idempotent. */
  kill(signal?: NodeJS.Signals): void;
}

const DEFAULT_RESTART: Extract<RestartPolicy, object> = {
  mode: "on-crash",
  maxRestarts: 5,
  baseDelayMs: 200,
  maxDelayMs: 5_000,
};

function normalizeRestart(p: RestartPolicy | undefined): Extract<RestartPolicy, object> | "never" {
  if (p === undefined || p === "never") return "never";
  if (p === "on-crash") return DEFAULT_RESTART;
  return p;
}

function defaultSpawn(spec: SupervisedSpec): SpawnedChild {
  return nodeSpawn(spec.command, [...(spec.args ?? [])], {
    stdio: ["pipe", "pipe", "pipe"],
    env: spec.env ?? sealedEnv(),
    cwd: spec.cwd,
  }) as SpawnedChild;
}

/** Bounded ring buffer for captured output (keeps the tail, drops the head). */
class OutputRing {
  #buf = "";
  private readonly cap: number;
  constructor(cap: number) {
    this.cap = cap;
  }
  push(chunk: string): void {
    this.#buf += chunk;
    if (this.#buf.length > this.cap) this.#buf = this.#buf.slice(this.#buf.length - this.cap);
  }
  get value(): string {
    return this.#buf;
  }
}

class Supervised implements SupervisedProcess {
  #state: ProcessState = "starting";
  #child: SpawnedChild | undefined;
  #restarts = 0;
  #killed = false;
  #idleTimer: ReturnType<typeof setTimeout> | undefined;
  #restartTimer: ReturnType<typeof setTimeout> | undefined;
  readonly #restart: Extract<RestartPolicy, object> | "never";
  readonly #idleMs: number;
  readonly stdout: OutputRing;
  readonly stderr: OutputRing;
  private readonly spec: SupervisedSpec;
  private readonly spawnFn: SpawnFn;
  private readonly events: ProcessEvents;
  private readonly onClosed: (id: string) => void;

  constructor(
    spec: SupervisedSpec,
    spawnFn: SpawnFn,
    events: ProcessEvents,
    onClosed: (id: string) => void,
  ) {
    this.spec = spec;
    this.spawnFn = spawnFn;
    this.events = events;
    this.onClosed = onClosed;
    this.#restart = normalizeRestart(spec.restart);
    this.#idleMs = spec.idleTimeoutMs ?? 0;
    const cap = spec.maxOutputBytes ?? 1024 * 1024;
    this.stdout = new OutputRing(cap);
    this.stderr = new OutputRing(cap);
    this.#start();
  }

  get id(): string {
    return this.spec.id;
  }
  get state(): ProcessState {
    return this.#state;
  }
  get pid(): number | undefined {
    return this.#child?.pid;
  }
  get restarts(): number {
    return this.#restarts;
  }

  #setState(state: ProcessState): void {
    this.#state = state;
    this.events.onState?.(state, { restarts: this.#restarts, pid: this.pid });
  }

  #start(): void {
    if (this.#killed) return;
    const child = this.spawnFn(this.spec);
    this.#child = child;
    this.#setState("running");
    this.#armIdle();

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (c: string) => {
      this.stdout.push(c);
      this.touch();
      this.events.onStdout?.(c);
    });
    child.stderr.on("data", (c: string) => {
      this.stderr.push(c);
      this.touch();
      this.events.onStderr?.(c);
    });
    child.on("exit", (code, signal) => this.#onExit(code, signal));
    child.on("error", () => this.#onExit(null, null));
  }

  #onExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.#clearIdle();
    if (this.#killed) {
      this.#setState("killed");
      this.events.onExit?.(code, signal, false);
      this.onClosed(this.id);
      return;
    }
    const crashed = code !== 0 || signal !== null;
    const policy = this.#restart;
    const canRestart =
      crashed && policy !== "never" && this.#restarts < policy.maxRestarts;
    this.events.onExit?.(code, signal, canRestart);
    if (!canRestart) {
      this.#setState("exited");
      this.onClosed(this.id);
      return;
    }
    const delay = Math.min(
      policy.maxDelayMs,
      policy.baseDelayMs * 2 ** this.#restarts,
    );
    this.#restarts += 1;
    this.#setState("restarting");
    this.#restartTimer = setTimeout(() => {
      this.#restartTimer = undefined;
      this.#start();
    }, delay);
  }

  #armIdle(): void {
    this.#clearIdle();
    if (this.#idleMs <= 0) return;
    this.#idleTimer = setTimeout(() => {
      // Idle reap: a quiet process is killed (PTY left open, wedged LSP, …).
      this.kill("SIGTERM");
    }, this.#idleMs);
  }

  #clearIdle(): void {
    if (this.#idleTimer) {
      clearTimeout(this.#idleTimer);
      this.#idleTimer = undefined;
    }
  }

  write(chunk: string): void {
    this.touch();
    this.#child?.stdin.write(chunk);
  }

  touch(): void {
    if (this.#idleMs > 0 && this.#state === "running") this.#armIdle();
  }

  kill(signal: NodeJS.Signals = "SIGTERM"): void {
    this.#killed = true;
    this.#clearIdle();
    if (this.#restartTimer) {
      clearTimeout(this.#restartTimer);
      this.#restartTimer = undefined;
    }
    const child = this.#child;
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    } else {
      // Already dead (or never started) — settle state + deregister.
      this.#setState("killed");
      this.onClosed(this.id);
    }
  }
}

export interface SupervisorOptions {
  /** Max concurrent supervised processes. Spawn beyond this throws. Default 64. */
  readonly maxProcesses?: number;
  /** Injectable spawn — tests pass a fake; production uses the default. */
  readonly spawnFn?: SpawnFn;
}

export class ProcessSupervisor {
  readonly #procs = new Map<string, Supervised>();
  readonly #max: number;
  readonly #spawnFn: SpawnFn;

  constructor(opts: SupervisorOptions = {}) {
    this.#max = opts.maxProcesses ?? 64;
    this.#spawnFn = opts.spawnFn ?? defaultSpawn;
  }

  /** Spawn (or replace) a supervised process under a stable id. */
  spawn(spec: SupervisedSpec, events: ProcessEvents = {}): SupervisedProcess {
    const existing = this.#procs.get(spec.id);
    if (existing) existing.kill();
    if (this.#procs.size >= this.#max) {
      throw new Error(
        `process supervisor at capacity (${this.#max}); reap before spawning ${spec.id}`,
      );
    }
    const proc = new Supervised(spec, this.#spawnFn, events, (id) => {
      this.#procs.delete(id);
    });
    this.#procs.set(spec.id, proc);
    return proc;
  }

  get(id: string): SupervisedProcess | undefined {
    return this.#procs.get(id);
  }

  list(): SupervisedProcess[] {
    return [...this.#procs.values()];
  }

  get size(): number {
    return this.#procs.size;
  }

  kill(id: string, signal?: NodeJS.Signals): void {
    this.#procs.get(id)?.kill(signal);
  }

  /** Reap everything (app shutdown / window close). */
  killAll(signal?: NodeJS.Signals): void {
    for (const proc of [...this.#procs.values()]) proc.kill(signal);
  }
}
