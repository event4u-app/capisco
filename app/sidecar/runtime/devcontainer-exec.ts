/**
 * Devcontainer lifecycle primitive (road-to-real-runtime P0).
 *
 * The MUTATING counterpart to the read-only `docker-exec.ts`: it brings a
 * workspace's devcontainer up (`devcontainer up`), runs a one-shot command in it
 * (`docker exec`), and tears it down (`docker rm -f`). Same no-shell posture as
 * docker-exec / git-exec — `execFile` with a discrete argv array, never a shell
 * string. Because it changes container state it is the broker-gated execution
 * edge (like install-exec.ts): the capability DECISION to start/stop a container
 * lives at the calling layer; this file is only the audited mechanism.
 *
 * `devcontainer up` reads the workspace's `.devcontainer/devcontainer.json`,
 * pulls/builds the image, starts the container, and prints a JSON result line
 * with the containerId + the remote workspace folder — the latter is exactly the
 * container-side root the {@link MountMap} (mount-map.ts) maps the host worktree
 * to. {@link parseDevcontainerUp} folds the CLI's mixed log+JSON stdout into that
 * result; it is pure and unit-tested without Docker.
 */

import { execFile } from "node:child_process";

const MAX_BUFFER = 16 * 1024 * 1024;
/** `up` can pull/build an image — generous; one-shot exec/rm are quick. */
const UP_TIMEOUT_MS = 300_000;
const SHORT_TIMEOUT_MS = 30_000;

export class DevcontainerError extends Error {}

/** The success result of `devcontainer up`. */
export interface DevcontainerUpResult {
  containerId: string;
  /** Container path the workspace is mounted at (feeds MountMap.workspaceEntry). */
  remoteWorkspaceFolder?: string;
  remoteUser?: string;
}

function run(command: string, args: readonly string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      [...args],
      { maxBuffer: MAX_BUFFER, timeout: timeoutMs, encoding: "utf8" },
      (err, stdout, stderr) => {
        if (err) reject(new DevcontainerError(`${command} ${args.join(" ")} failed: ${stderr || err.message}`));
        else resolve(stdout);
      },
    );
  });
}

/** True when the `devcontainer` CLI is on PATH. */
export async function devcontainerAvailable(): Promise<boolean> {
  try {
    await run("devcontainer", ["--version"], SHORT_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fold `devcontainer up` stdout (mixed progress logs + a final JSON line) into
 * the success result. Scans from the end for the first JSON object carrying an
 * `outcome` + `containerId`. Pure — no process, unit-tested.
 */
export function parseDevcontainerUp(stdout: string): DevcontainerUpResult {
  const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.startsWith("{")) continue;
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      if (typeof obj.containerId === "string" && obj.outcome === "success") {
        return {
          containerId: obj.containerId,
          remoteWorkspaceFolder:
            typeof obj.remoteWorkspaceFolder === "string" ? obj.remoteWorkspaceFolder : undefined,
          remoteUser: typeof obj.remoteUser === "string" ? obj.remoteUser : undefined,
        };
      }
    } catch {
      /* not the JSON result line — keep scanning */
    }
  }
  throw new DevcontainerError("devcontainer up did not report a success result with a containerId");
}

/** Bring the workspace's devcontainer up (idempotent). Returns the container id. */
export async function devcontainerUp(
  workspaceFolder: string,
  opts: { idLabel?: string } = {},
): Promise<DevcontainerUpResult> {
  const args = ["up", "--workspace-folder", workspaceFolder];
  if (opts.idLabel) args.push("--id-label", opts.idLabel);
  return parseDevcontainerUp(await run("devcontainer", args, UP_TIMEOUT_MS));
}

/** Run a one-shot, non-interactive command in a container. Returns stdout. */
export async function execInContainer(containerId: string, argv: readonly string[]): Promise<string> {
  return run("docker", ["exec", containerId, ...argv], SHORT_TIMEOUT_MS);
}

/**
 * Run a one-shot command in a container, feeding `stdin` to it over a pipe
 * (`docker exec -i`). This is the SECRET-SAFE injection edge (road-to-real-runtime
 * P0, Council-Trap, security-sensitive): a credential is delivered ONLY through
 * the process's stdin, so it never lands in `argv` (visible in `ps`), the image,
 * or a layer — unlike `docker exec -e VAR=value`, which leaks the value into the
 * command line. The caller obtains the value solely via `SecretStore.inject(ref,
 * cb)` (secret-by-reference); `stdin` is the value inside that callback and the
 * argv passed here carries none of it.
 */
export function execInContainerWithStdin(
  containerId: string,
  argv: readonly string[],
  stdin: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "docker",
      ["exec", "-i", containerId, ...argv],
      { maxBuffer: MAX_BUFFER, timeout: SHORT_TIMEOUT_MS, encoding: "utf8" },
      (err, stdout, stderr) => {
        if (err) reject(new DevcontainerError(`docker exec -i ${containerId} failed: ${stderr || err.message}`));
        else resolve(stdout);
      },
    );
    // The secret value crosses ONLY here — the pipe — never the argv above.
    child.stdin?.end(stdin);
  });
}

/** Start a stopped/killed container again (the recovery action after a crash). */
export async function startContainer(containerId: string): Promise<void> {
  await run("docker", ["start", containerId], SHORT_TIMEOUT_MS);
}

/** Tear a container down (force-remove). Idempotent enough for cleanup. */
export async function removeContainer(containerId: string): Promise<void> {
  await run("docker", ["rm", "-f", containerId], SHORT_TIMEOUT_MS);
}

/** The result of a one-shot containerized tool run. */
export interface ContainerToolRun {
  stdout: string;
  /** The tool's exit code (non-zero often just means "found problems" — data). */
  exitCode: number | null;
}

/**
 * Run a one-shot tool in an EPHEMERAL container (`docker run --rm`), mounting a
 * host dir read-only at `containerDir` (default `/app`). For quality tools whose
 * toolchain is not on the host (PHPStan/Rector/ECS run from a PHP image, real-
 * runtime P2): the worktree is read-only-mounted, the tool analyses it, the
 * container is discarded. Never rejects on a non-zero exit — a tool that finds
 * problems exits non-zero, and the parser, not the exit code, is the truth.
 */
export function runContainerTool(input: {
  image: string;
  args: readonly string[];
  hostDir: string;
  containerDir?: string;
  /** Working directory inside the container (`-w`). Tools that report paths
   * relative to cwd (Rector/ECS) set this to `containerDir` for clean paths. */
  workdir?: string;
  timeoutMs?: number;
}): Promise<ContainerToolRun> {
  const containerDir = input.containerDir ?? "/app";
  const dockerArgs = [
    "run",
    "--rm",
    "-v",
    `${input.hostDir}:${containerDir}:ro`,
    ...(input.workdir ? ["-w", input.workdir] : []),
    input.image,
    ...input.args,
  ];
  return new Promise((resolve) => {
    execFile(
      "docker",
      dockerArgs,
      { maxBuffer: MAX_BUFFER, timeout: input.timeoutMs ?? UP_TIMEOUT_MS, encoding: "utf8" },
      (err, stdout) => {
        const exitCode =
          err && typeof (err as { code?: unknown }).code === "number"
            ? (err as { code: number }).code
            : err
              ? null
              : 0;
        resolve({ stdout, exitCode });
      },
    );
  });
}

/** Remove every container carrying an id-label (cleanup of a labelled test run). */
export async function removeContainersByLabel(label: string): Promise<void> {
  const ids = (await run("docker", ["ps", "-aq", "--filter", `label=${label}`], SHORT_TIMEOUT_MS))
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const id of ids) await removeContainer(id);
}
