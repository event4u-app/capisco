/**
 * Thin, safe wrapper around the system `git` binary (B1, road-to-real-git).
 *
 * Security posture: never go through a shell. We use `execFile` with an
 * explicit argv array so paths/refs/messages are passed as discrete arguments,
 * not interpolated into a command string — no shell-injection surface. Every
 * call is scoped to a working directory via `-C <cwd>`.
 *
 * The broker (B4) will later own *which* git invocations an agent may run; this
 * helper is the first-party execution primitive the broker mediates. It is not
 * an open-ended shell escape — only `git` subcommands flow through it.
 */

import { execFile } from "node:child_process";

export interface GitExecResult {
  stdout: string;
  stderr: string;
}

export class GitError extends Error {
  readonly code: number | null;
  readonly stderr: string;

  constructor(message: string, code: number | null, stderr: string) {
    super(message);
    this.name = "GitError";
    this.code = code;
    this.stderr = stderr;
  }
}

/** Max stdout buffer for a single git invocation (10 MiB — large diffs/logs). */
const MAX_BUFFER = 10 * 1024 * 1024;

/**
 * Run `git -C <cwd> <args...>` with no shell. Rejects with {@link GitError} on a
 * non-zero exit. `allowFail` returns the result instead of throwing for commands
 * whose non-zero exit is informational (e.g. `git diff --quiet`).
 */
export function git(
  cwd: string,
  args: string[],
  opts: { allowFail?: boolean } = {},
): Promise<GitExecResult> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-C", cwd, ...args],
      { maxBuffer: MAX_BUFFER, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error && !opts.allowFail) {
          const code = typeof error.code === "number" ? error.code : null;
          reject(
            new GitError(
              `git ${args.join(" ")} failed (${code ?? "signal"}): ${stderr.trim() || error.message}`,
              code,
              stderr,
            ),
          );
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}
