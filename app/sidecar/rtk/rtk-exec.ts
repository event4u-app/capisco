/**
 * RTK exec primitive (Phase 3, token-economy) — the single audited home for
 * spawning the external `rtk` Rust binary.
 *
 * Posture mirrors `git-exec.ts` / `detect-exec.ts`: NEVER through a shell —
 * `execFile` with a discrete argv array (B1 git discipline), so nothing is
 * interpolated into a command string (no shell-injection surface). The raw tool
 * output is written to the child's STDIN; the compressed text comes back on
 * STDOUT.
 *
 * RTK is a BROKER-RELEVANT capability (an untrusted external binary in the data
 * path, AK-T5) — it is NOT a free exception. But it is a READ-shaped transform
 * (text in → text out, mutates nothing), so this primitive is the audited place
 * it physically lives; the compressor (`rtk-compressor.ts`) decides WHEN to run
 * it and brands the output LLM-facing-only.
 *
 * CLEAN DEGRADE (the hard requirement): if `rtk` is not installed, this returns
 * `undefined` — never throws, never hard-fails. The caller passes the raw output
 * through unchanged. A wedged binary cannot hang: a bounded timeout kills it and
 * also degrades to `undefined`.
 *
 * DEFERRED: the real `rtk` binary (brew/cargo/curl install, user broker-approved)
 * is the thin swap — this primitive already speaks its stdin/stdout contract.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

/** The default RTK binary name (resolved on PATH; absolute path used directly). */
export const RTK_COMMAND = "rtk";

/** Max compressed-stdout buffer (long-tail output can be large; cap defensively). */
const MAX_BUFFER = 8 * 1024 * 1024;

/** Per-run timeout — a wedged binary degrades to `undefined`, never hangs. */
const RTK_TIMEOUT_MS = 4000;

/** Resolve the `rtk` binary to an existing path, or `undefined` if not installed. */
export function resolveRtkPath(
  command: string = RTK_COMMAND,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (!command) return undefined;
  if (isAbsolute(command) || command.includes("/")) {
    return existsSync(command) ? command : undefined;
  }
  const pathVar = env.PATH ?? "";
  for (const dir of pathVar.split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, command);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** True when the `rtk` binary is installed (a read-only PATH probe). */
export function rtkAvailable(
  command: string = RTK_COMMAND,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveRtkPath(command, env) !== undefined;
}

export interface RtkExecOptions {
  /** Override the binary (tests point this at a deterministic fixture filter). */
  command?: string;
  /** Extra argv passed to `rtk` (discrete args, never a shell string). */
  args?: string[];
  /** Environment for the spawn + PATH resolution. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Compress `raw` text by piping it through the external `rtk` binary. Returns the
 * compressed stdout, or `undefined` when `rtk` is not installed / fails / times
 * out (CLEAN DEGRADE — never throws). The raw output is the child's stdin; the
 * args are discrete (no shell).
 */
export function rtkCompress(raw: string, opts: RtkExecOptions = {}): Promise<string | undefined> {
  const env = opts.env ?? process.env;
  const resolved = resolveRtkPath(opts.command ?? RTK_COMMAND, env);
  if (!resolved) return Promise.resolve(undefined); // not installed → degrade
  const args = opts.args ?? [];
  return new Promise((resolve) => {
    const child = execFile(
      resolved,
      args,
      { maxBuffer: MAX_BUFFER, timeout: RTK_TIMEOUT_MS, encoding: "utf8", env },
      (error, stdout) => {
        // Any error (missing, non-zero, timeout, oversized) → degrade to undefined.
        if (error) {
          resolve(undefined);
          return;
        }
        resolve(stdout);
      },
    );
    // Feed the raw output on stdin, then close it so `rtk` finishes the turn.
    try {
      child.stdin?.end(raw);
    } catch {
      resolve(undefined);
    }
  });
}
