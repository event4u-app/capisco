/**
 * Read-only `docker` exec primitive (road-to-real-runtime P0).
 *
 * The single audited home for one-shot, READ-ONLY docker introspection
 * (`docker ps`, `docker stats --no-stream`, `docker inspect`). Posture mirrors
 * git-exec.ts / detect-exec.ts: NEVER through a shell — `execFile` with a
 * discrete argv array, so a value is never interpolated into a command string.
 * It mutates nothing; a mutating-verb guard refuses run/rm/exec/kill/stop so this
 * primitive can never be repurposed to change container state (that path, when
 * it lands, is broker-gated like install-exec.ts).
 *
 * The streaming `docker stats` (long-lived) is NOT here — it spawns through the
 * process supervisor (the allowlisted long-lived-spawn primitive).
 */

import { execFile } from "node:child_process";

const MAX_BUFFER = 8 * 1024 * 1024;
const TIMEOUT_MS = 8000;

/** Verbs that change state — refused so this read-only primitive stays read-only. */
const MUTATING = new Set([
  "run", "rm", "exec", "kill", "stop", "start", "restart", "create", "build",
  "pull", "push", "rmi", "prune", "cp", "commit", "tag", "login", "logout", "compose",
]);

export class DockerError extends Error {}

/** True when the `docker` CLI is on PATH and the daemon answers. */
export async function dockerAvailable(): Promise<boolean> {
  try {
    await dockerExec(["version", "--format", "{{.Server.Version}}"]);
    return true;
  } catch {
    return false;
  }
}

/** Run a read-only `docker` command; returns stdout. Refuses mutating verbs. */
export function dockerExec(args: readonly string[]): Promise<string> {
  const verb = args[0];
  if (verb && MUTATING.has(verb)) {
    return Promise.reject(new DockerError(`refused mutating docker verb: ${verb} (read-only primitive)`));
  }
  return new Promise((resolve, reject) => {
    execFile("docker", [...args], { maxBuffer: MAX_BUFFER, timeout: TIMEOUT_MS, encoding: "utf8" }, (err, stdout, stderr) => {
      if (err) reject(new DockerError(`docker ${args.join(" ")} failed: ${stderr || err.message}`));
      else resolve(stdout);
    });
  });
}

/** A container's lifecycle state, or `absent` when no such container exists. */
export type ContainerLifecycleState = "running" | "exited" | "created" | "paused" | "absent";

/**
 * Read a container's lifecycle state via `docker inspect` (read-only). An absent
 * container (inspect errors) maps to `absent` — the health signal a crash/kill
 * recovery flow watches for (road-to-real-runtime P4).
 */
export async function containerStatus(containerId: string): Promise<ContainerLifecycleState> {
  try {
    const out = (await dockerExec(["inspect", "-f", "{{.State.Status}}", containerId])).trim();
    if (out === "running" || out === "exited" || out === "created" || out === "paused") return out;
    return "absent";
  } catch {
    return "absent"; // no such container
  }
}

/** Parse NDJSON (one JSON object per line) — the shape of `docker … --format json`. */
export function parseNdjson<T = Record<string, unknown>>(text: string): T[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}
