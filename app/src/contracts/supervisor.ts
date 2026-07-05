/**
 * Process-supervisor provider contract (agent-matrix P0 — the process half of
 * the process/container bar). Frontend seam over the sidecar `ProcessSupervisor`
 * (`sidecar/supervisor/process-supervisor.ts`): the Matrix reads a health
 * snapshot of every supervised process (PTY / LSP / DAP / agent) and subscribes
 * to live changes. Lifecycle facts ONLY — no command, no output, no secret —
 * mirroring the sidecar `ProcessHealth` shape so the real adapter is a thin swap
 * behind this same interface (the deterministic {@link
 * "@/mocks".mockSupervisorProvider} replays a scripted snapshot until then).
 */

import type { Unsubscribe } from "./agents.ts";

/** Supervised-process lifecycle state (mirrors the sidecar state machine). */
export type ProcessState = "starting" | "running" | "restarting" | "exited" | "killed";

/**
 * A health snapshot of one supervised process. Carries no command/output/secret
 * — just the "what's running, how many restarts, which pid" facts the Matrix
 * process strip renders.
 */
export interface ProcessHealth {
  /** Stable id, e.g. `pty:term-1`, `lsp:ts:/repo`, `dap:php:9003`, `agent:s1`. */
  readonly id: string;
  readonly state: ProcessState;
  readonly pid: number | undefined;
  readonly restarts: number;
}

/**
 * The supervisor provider seam (deferred-real, fake-now). Reports the current
 * health snapshot and lets a consumer subscribe to a deterministic stream of
 * snapshots — the same out-of-band pattern as {@link RuntimeProvider}.
 */
export interface SupervisorProvider {
  /** Snapshot of every supervised process's health. */
  health(): Promise<ProcessHealth[]>;
  /**
   * Subscribe to health changes. The listener fires with a fresh full snapshot;
   * the fake replays a finite deterministic sequence on microtasks (no
   * `Date.now` / no `Math.random` / no real timers). Returns an unsubscribe.
   */
  subscribe(listener: (health: ProcessHealth[]) => void): Unsubscribe;
}
