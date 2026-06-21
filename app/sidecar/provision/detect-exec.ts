/**
 * Read-only backend-detection primitive (B8 P0).
 *
 * The single audited home for the READ-ONLY tooling probes the provisioner uses
 * to detect installed agent CLIs: resolving a binary on `PATH` and reading a
 * `--version`. Posture mirrors `git-exec.ts`: NEVER through a shell — `execFile`
 * with a discrete argv array, so a binary name is never interpolated into a
 * command string (no shell-injection surface). These are pure introspection
 * calls (`which`, `<cli> --version`) — they mutate nothing.
 *
 * This file is listed in the broker-chokepoint architecture test as an
 * allowlisted `process` primitive: it is the only place outside the broker's
 * mediated execution that may spawn, and it spawns ONLY read-only probes. The
 * INSTALL path (a consequential, mutating spawn) lives in a separate primitive
 * (`install-exec.ts`) whose sole caller is the broker-gated installer.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

/** Max stdout buffer for a probe (`--version` output is tiny; cap defensively). */
const MAX_BUFFER = 1 * 1024 * 1024;

/** Per-probe timeout — a wedged binary must never hang detection. */
const PROBE_TIMEOUT_MS = 4000;

/**
 * Resolve a CLI command to an existing executable path, or `undefined` if it is
 * not installed. A bare name is searched on `PATH`; an absolute/relative path is
 * checked directly. No spawn — a pure `existsSync` walk (read-only). Mirrors the
 * resolver in `real-acp-config.ts` (kept local so detection has no cross-module
 * coupling to the ACP adapter).
 */
export function resolveBinaryPath(
  command: string,
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

/**
 * Run a read-only `<command> <args...>` probe with NO shell and return its
 * trimmed stdout, or `undefined` if the binary is missing / the probe fails /
 * times out. The args are intended to be read-only flags (`--version`,
 * `--help`); this primitive does not police them, but its only caller (the
 * provisioner) passes version flags exclusively, and a denylist guard rejects
 * any obviously mutating verb to keep the primitive honest.
 */
export function probeVersion(
  command: string,
  args: string[] = ["--version"],
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | undefined> {
  // Honesty guard: this primitive is for read-only probes only. Reject any arg
  // that is a known mutating verb so it can never be repurposed as an install
  // path (installs go through the broker-gated `install-exec.ts`).
  for (const a of args) {
    if (MUTATING_PROBE_ARGS.has(a)) {
      return Promise.reject(
        new Error(`detect probe refuses a mutating arg: ${a} (use the broker-gated installer)`),
      );
    }
  }
  const resolved = resolveBinaryPath(command, env);
  if (!resolved) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    execFile(
      resolved,
      args,
      { maxBuffer: MAX_BUFFER, timeout: PROBE_TIMEOUT_MS, encoding: "utf8", env },
      (error, stdout, stderr) => {
        if (error) {
          // Some CLIs print version to stderr; salvage it before giving up.
          const fallback = (stdout || stderr || "").trim();
          resolve(fallback || undefined);
          return;
        }
        resolve(stdout.trim() || stderr.trim() || undefined);
      },
    );
  });
}

/** Probe verbs that are NOT read-only — refused by {@link probeVersion}. */
const MUTATING_PROBE_ARGS: ReadonlySet<string> = new Set([
  "i",
  "install",
  "add",
  "update",
  "upgrade",
  "uninstall",
  "remove",
  "exec",
  "run",
]);
