/**
 * Terminal-provider contract (road-to-actually-works P6 — real PTY).
 *
 * Under the xterm.js panel runs a REAL shell, not a scripted transcript. The
 * sidecar opens a pseudo-terminal (node-pty) per tab THROUGH the P1 process
 * supervisor (the shared spawn/reap/restart primitive — a PTY is one of its four
 * backends alongside LSP / container-exec / DAP), streams its merged output to
 * the consumer, and forwards keystrokes + resize back.
 *
 * Transport posture mirrors {@link RuntimeProvider.subscribeStats} and the
 * session store: reads/commands are request/response; live output is a push
 * subscription returning an {@link Unsubscribe}. The same contract is the WS
 * dev-bridge surface today and the Tauri-IPC surface later (Phase 7) — the
 * carrier swaps, the shape does not.
 */

import type { Unsubscribe } from "./agents.ts";

/** A request to open a terminal. */
export interface TerminalOpenSpec {
  /** Caller-chosen stable id (e.g. a tab id). Re-opening an id replaces it. */
  id: string;
  /** Working directory — the active worktree root. */
  cwd: string;
  /** Initial window size. Defaults to 80×24 when omitted. */
  cols?: number;
  rows?: number;
  /**
   * Shell to run. Defaults to the user's `$SHELL` (then `/bin/bash`, `/bin/sh`).
   * No arbitrary command injection — this is a login shell, argv is fixed.
   */
  shell?: string;
}

/** Lifecycle state of a terminal, surfaced to the tab UI. */
export type TerminalState = "running" | "exited";

/** A live event from one terminal: merged output, or its exit. */
export type TerminalEvent =
  | { readonly id: string; readonly kind: "data"; readonly data: string }
  | {
      readonly id: string;
      readonly kind: "exit";
      readonly exitCode: number | null;
      readonly signal: string | null;
    };

/** A snapshot of one open terminal (no output — lifecycle facts only). */
export interface TerminalInfo {
  readonly id: string;
  readonly state: TerminalState;
  readonly pid: number | undefined;
}

/**
 * The terminal provider seam (real PTY). `open` starts a shell; `write` forwards
 * keystrokes; `resize` propagates the xterm cols/rows; `close` reaps it;
 * `subscribe` streams every terminal's output + exit. The real node-pty adapter
 * implements this; a deterministic fake drives hermetic tests.
 */
export interface TerminalProvider {
  /** Open a shell PTY under `spec.id`. Returns once the PTY is running. */
  open(spec: TerminalOpenSpec): Promise<TerminalInfo>;
  /** Forward input (keystrokes) to a terminal's stdin. */
  write(id: string, data: string): Promise<void>;
  /** Propagate a window resize (xterm cols/rows → PTY). */
  resize(id: string, cols: number, rows: number): Promise<void>;
  /** Reap a terminal (tab close / split-kill). Idempotent. */
  close(id: string): Promise<void>;
  /** Every currently-open terminal (the tab bar's source of truth). */
  list(): Promise<TerminalInfo[]>;
  /**
   * Subscribe to one terminal's live events (data + exit). Per-terminal so it
   * maps onto the IPC stream channel `terminal:<id>` (mirrors the agent's
   * per-session subscribe). Subscribe BEFORE `open` to catch the shell's first
   * output (the prompt). Returns an unsubscribe handle.
   */
  subscribe(id: string, listener: (event: TerminalEvent) => void): Unsubscribe;
}
