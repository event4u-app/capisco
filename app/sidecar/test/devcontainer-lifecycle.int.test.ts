/**
 * Devcontainer lifecycle (road-to-real-runtime P0).
 *  - PURE: parseDevcontainerUp folds the CLI's mixed log+JSON stdout (always runs).
 *  - LIVE: against the REAL devcontainer CLI + Docker daemon — bring a minimal
 *    alpine devcontainer up, exec a command in it, tear it down. Skips cleanly
 *    when docker / devcontainer are not both on PATH. Also cross-checks that the
 *    CLI's remoteWorkspaceFolder matches the MountMap's container root, linking
 *    the lifecycle to the host↔container mapping (mount-map.ts).
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  devcontainerUp,
  execInContainer,
  parseDevcontainerUp,
  removeContainersByLabel,
} from "../runtime/devcontainer-exec.ts";
import { deriveMountMap } from "../runtime/mount-map.ts";

describe("parseDevcontainerUp", () => {
  it("extracts the success result from mixed log + JSON stdout", () => {
    const stdout = [
      "[12:00:00] Resolving Remote workspace folder...",
      "@devcontainers/cli 0.81.0",
      '{"outcome":"success","containerId":"abc123","remoteUser":"root","remoteWorkspaceFolder":"/workspaces/repo"}',
    ].join("\n");
    expect(parseDevcontainerUp(stdout)).toEqual({
      containerId: "abc123",
      remoteUser: "root",
      remoteWorkspaceFolder: "/workspaces/repo",
    });
  });

  it("ignores a non-success JSON line and throws when no success result is present", () => {
    expect(() => parseDevcontainerUp('{"outcome":"error","message":"boom"}')).toThrow(/success result/);
    expect(() => parseDevcontainerUp("just logs, no json")).toThrow(/success result/);
  });
});

function which(cmd: string): boolean {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir && existsSync(join(dir, cmd))) return true;
  }
  return false;
}

const live = which("docker") && which("devcontainer");
const runLive = live ? it : it.skip;
const LABEL = "capisco.devcontainer-lifecycle-test=1";

describe("devcontainer lifecycle ↔ real CLI + Docker", () => {
  let dir: string;

  beforeAll(() => {
    if (!live) return;
    dir = mkdtempSync(join(tmpdir(), "capisco-devc-"));
    mkdirSync(join(dir, ".devcontainer"), { recursive: true });
    // A minimal image-only devcontainer — no build, just pull + start.
    writeFileSync(
      join(dir, ".devcontainer", "devcontainer.json"),
      JSON.stringify({ name: "capisco-test", image: "alpine:3.20" }),
      "utf8",
    );
  });

  afterAll(async () => {
    if (!live) return;
    try {
      await removeContainersByLabel(LABEL);
    } finally {
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  runLive(
    "brings a workspace's devcontainer up, execs in it, and the container root matches the MountMap",
    async () => {
      const up = await devcontainerUp(dir, { idLabel: LABEL });
      expect(up.containerId).toMatch(/^[0-9a-f]{12,}$/);

      // The real CLI's remote workspace folder is what the MountMap maps the host
      // worktree to — derived independently here, they must agree.
      const expectedRoot = deriveMountMap({ localWorkspaceFolder: dir }).workspaceEntry()?.containerPath;
      expect(expectedRoot).toBe(`/workspaces/${basename(dir)}`);
      expect(up.remoteWorkspaceFolder).toBe(expectedRoot);

      // A one-shot command runs inside the real container.
      const out = await execInContainer(up.containerId, ["echo", "capisco-ok"]);
      expect(out.trim()).toBe("capisco-ok");
    },
    300_000,
  );
});
