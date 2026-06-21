/**
 * Install execution primitive (B8 P1) — the audited home for the MUTATING spawn
 * an agent-tooling install requires (e.g. `npm i -g @zed-industries/claude-code-acp`).
 *
 * Posture mirrors `git-exec.ts` / `fs-write-exec.ts`: NEVER through a shell —
 * `execFile` with a discrete argv array, no interpolation, no shell-injection
 * surface. This is the ONLY place a consequential install command physically
 * runs, and its SOLE caller is the broker-gated installer (`install-broker.ts`),
 * which runs it exclusively inside `broker.execute`. A denied capability never
 * reaches this file → no install happens.
 *
 * Listed in the broker-chokepoint architecture test as an allowlisted `process`
 * primitive.
 *
 * AUTONOMY: the live network/global install is the user's broker-approved go.
 * The build verifies the path with a DRY/echo command (no real install). The
 * `command` is supplied by the caller (the detected backend's `installCommand`,
 * or a dry/echo override in tests) — this primitive does not invent one.
 */

import { execFile } from "node:child_process";

export interface InstallExecResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Max stdout buffer for an install (npm output can be chatty). */
const MAX_BUFFER = 8 * 1024 * 1024;

/** A generous install timeout — a real `npm i -g` can take a while. */
const INSTALL_TIMEOUT_MS = 120_000;

/**
 * Run an install command `[bin, ...args]` with NO shell. Resolves with the exit
 * code + captured streams (never rejects on a non-zero exit — the caller decides
 * what a failure means and reports it as `installed:false`, never a silent
 * success). An empty argv is rejected (nothing to run).
 */
export function runInstall(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<InstallExecResult> {
  if (argv.length === 0) {
    return Promise.reject(new Error("install command is empty"));
  }
  const [bin, ...args] = argv;
  return new Promise((resolve) => {
    execFile(
      bin,
      args,
      { maxBuffer: MAX_BUFFER, timeout: INSTALL_TIMEOUT_MS, encoding: "utf8", env },
      (error, stdout, stderr) => {
        if (error) {
          const code = typeof error.code === "number" ? error.code : null;
          resolve({ ok: false, code, stdout: stdout ?? "", stderr: stderr || error.message });
          return;
        }
        resolve({ ok: true, code: 0, stdout, stderr });
      },
    );
  });
}
