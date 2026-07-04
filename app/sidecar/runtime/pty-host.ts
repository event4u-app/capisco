/**
 * PTY host (road-to-actually-works P6) — the sidecar half of the real terminal.
 *
 * Opens one shell pseudo-terminal per tab THROUGH the P1 process supervisor
 * (constructed with the {@link spawnPty} backend), fans every PTY's merged
 * output + exit out to subscribers, and forwards keystrokes + resize back. This
 * is what the `terminal` IPC provider wraps; the xterm.js binding consumes it.
 *
 * It inherits the supervisor's lifecycle for free: a wedged shell idle-reaps, a
 * crashed shell can restart (off by default — a terminal exiting is normal, so
 * the policy is `never`; the tab shows "exited" and the user reopens). Working
 * dir is the active worktree (the caller passes it per open).
 */

import {
  ProcessSupervisor,
  type SupervisedProcess,
} from "../supervisor/process-supervisor.ts";
import { spawnPty } from "./pty-exec.ts";
import type {
  TerminalEvent,
  TerminalInfo,
  TerminalOpenSpec,
  TerminalProvider,
} from "@/contracts";

export interface PtyHostOptions {
  /**
   * Inject a supervisor (tests pass one with a fake `spawnFn`). Defaults to a
   * fresh supervisor wired to the real {@link spawnPty} backend.
   */
  supervisor?: ProcessSupervisor;
  /** Default shell when an open spec omits one. Resolved from `$SHELL` if unset. */
  defaultShell?: string;
}

/** Resolve the login shell: explicit → `$SHELL` → `/bin/bash` → `/bin/sh`. */
function resolveShell(explicit: string | undefined, env: NodeJS.ProcessEnv): string {
  return explicit ?? env.SHELL ?? "/bin/bash";
}

export class PtyHost implements TerminalProvider {
  readonly #sup: ProcessSupervisor;
  readonly #defaultShell: string | undefined;
  /** Open terminals by id (the supervised process handle). */
  readonly #procs = new Map<string, SupervisedProcess>();
  /** Per-terminal event listeners, keyed by terminal id (channel `terminal:<id>`). */
  readonly #listeners = new Map<string, Set<(event: TerminalEvent) => void>>();

  constructor(opts: PtyHostOptions = {}) {
    this.#sup = opts.supervisor ?? new ProcessSupervisor({ spawnFn: spawnPty });
    this.#defaultShell = opts.defaultShell;
  }

  open(spec: TerminalOpenSpec): Promise<TerminalInfo> {
    // Container console (`docker exec -it`) vs. a host login shell. Both run over
    // the PTY (node-pty), so `-it` gets a real tty and the session is interactive.
    const container = spec.container;
    const command = container ? "docker" : resolveShell(spec.shell ?? this.#defaultShell, process.env);
    const args = container
      ? ["exec", "-it", container, spec.shell ?? "/bin/sh"]
      : ["-l"]; // host login shell — discrete argv, no shell-string injection
    const proc = this.#sup.spawn(
      {
        id: spec.id,
        command,
        args,
        // docker runs on the host; the exec's cwd is the container's own workdir.
        cwd: container ? undefined : spec.cwd,
        cols: spec.cols ?? 80,
        rows: spec.rows ?? 24,
        restart: "never",
      },
      {
        onStdout: (data) => this.#emit({ id: spec.id, kind: "data", data }),
        onExit: (exitCode, signal) =>
          this.#emit({ id: spec.id, kind: "exit", exitCode, signal }),
      },
    );
    this.#procs.set(spec.id, proc);
    return Promise.resolve({ id: spec.id, state: "running", pid: proc.pid });
  }

  write(id: string, data: string): Promise<void> {
    this.#procs.get(id)?.write(data);
    return Promise.resolve();
  }

  resize(id: string, cols: number, rows: number): Promise<void> {
    this.#procs.get(id)?.resize(cols, rows);
    return Promise.resolve();
  }

  close(id: string): Promise<void> {
    this.#procs.get(id)?.kill();
    this.#procs.delete(id);
    return Promise.resolve();
  }

  list(): Promise<TerminalInfo[]> {
    const infos: TerminalInfo[] = [];
    for (const [id, proc] of this.#procs) {
      infos.push({ id, state: proc.state === "running" ? "running" : "exited", pid: proc.pid });
    }
    return Promise.resolve(infos);
  }

  subscribe(id: string, listener: (event: TerminalEvent) => void): () => void {
    let set = this.#listeners.get(id);
    if (!set) {
      set = new Set();
      this.#listeners.set(id, set);
    }
    set.add(listener);
    return () => {
      const s = this.#listeners.get(id);
      s?.delete(listener);
      if (s && s.size === 0) this.#listeners.delete(id);
    };
  }

  /** Reap every terminal (window close / shutdown). */
  killAll(): void {
    this.#sup.killAll();
    this.#procs.clear();
  }

  #emit(event: TerminalEvent): void {
    const set = this.#listeners.get(event.id);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(event);
      } catch {
        /* a subscriber's failure is its own — never breaks the host */
      }
    }
  }
}
