/**
 * The PTY spawn primitive (road-to-actually-works P6) — the audited home for
 * node-pty's `spawn`. A pseudo-terminal is a real subprocess with a tty, so this
 * is a `process` side effect and lives on the broker-chokepoint allowlist
 * (broker-chokepoint.test.ts). Posture matches the supervisor / claude-stream-
 * exec: SEALED env (allowlist, no secrets), discrete argv (no shell string), and
 * the capability DECISION to open a terminal is gated at the calling layer
 * (the PtyHost / terminal provider), the same as LSP/container spawns.
 *
 * Unlike a stdio child, a PTY exposes ONE merged data stream (no stderr) plus a
 * window resize. {@link wrapPty} adapts node-pty's `IPty` to the supervisor's
 * {@link SupervisedHandle} so the SAME lifecycle machine (state, backoff
 * restart, idle reap, health) drives a terminal exactly as it drives an LSP.
 */

import { createRequire } from "node:module";
import { constants as osConstants } from "node:os";

import type { IPty } from "node-pty";

// node-pty is a native (CJS) addon whose `pty.node` binding has no prebuild on
// the Linux CI runner. Load it LAZILY — a type-only import above erases at
// runtime, and the binding is required on first real spawn — so merely importing
// this module (e.g. from a fake-backend test, or any transitive consumer) never
// triggers the native load. Only an actual `spawnPty` call touches node-pty.
const requireCjs = createRequire(import.meta.url);
let ptySpawnFn: typeof import("node-pty").spawn | undefined;
function ptySpawn(...args: Parameters<typeof import("node-pty").spawn>): IPty {
  ptySpawnFn ??= (requireCjs("node-pty") as typeof import("node-pty")).spawn;
  return ptySpawnFn(...args);
}

import {
  sealedEnv,
  type SupervisedHandle,
  type SupervisedSpec,
} from "../supervisor/process-supervisor.ts";

/** Map a node-pty numeric exit signal to a name; 0/undefined → no signal. */
function signalName(signal: number | undefined): NodeJS.Signals | null {
  if (!signal) return null;
  const names = osConstants.signals as Record<string, number>;
  for (const name of Object.keys(names) as NodeJS.Signals[]) {
    if (names[name] === signal) return name;
  }
  return "SIGKILL";
}

/**
 * Adapt a node-pty `IPty` to the supervisor's {@link SupervisedHandle}. The
 * merged PTY output is surfaced as `onStdout` (so `onStderr` never fires — no
 * synthetic stderr); `resize` is present (a PTY has a window); `alive` is
 * tracked off the single `onExit`.
 */
export function wrapPty(pty: IPty): SupervisedHandle {
  let alive = true;
  pty.onExit(() => {
    alive = false;
  });
  return {
    get pid() {
      return pty.pid;
    },
    get alive() {
      return alive;
    },
    onStdout(listener) {
      pty.onData(listener);
    },
    onStderr() {
      /* a PTY merges all output into the data stream — never fires */
    },
    onExit(listener) {
      pty.onExit(({ exitCode, signal }) => listener(exitCode, signalName(signal)));
    },
    onError() {
      /* node-pty surfaces failure as an exit, not a separate error event */
    },
    write(chunk) {
      pty.write(chunk);
    },
    kill(signal) {
      // node-pty throws if the process already exited — killing is best-effort.
      try {
        pty.kill(signal);
      } catch {
        /* already dead */
      }
    },
    resize(cols, rows) {
      try {
        pty.resize(cols, rows);
      } catch {
        /* resizing a dead PTY is a no-op */
      }
    },
  };
}

/**
 * A {@link SpawnFn} that opens a real PTY for a spec. Pass it as the supervisor's
 * `spawnFn` so terminal specs spawn pseudo-terminals while the lifecycle machine
 * stays the shared one. Returns a pre-wrapped {@link SupervisedHandle}.
 */
export function spawnPty(spec: SupervisedSpec): SupervisedHandle {
  const pty = ptySpawn(spec.command, [...(spec.args ?? [])], {
    name: spec.term ?? "xterm-256color",
    cols: spec.cols ?? 80,
    rows: spec.rows ?? 24,
    cwd: spec.cwd,
    env: (spec.env ?? sealedEnv()) as Record<string, string>,
  });
  return wrapPty(pty);
}
