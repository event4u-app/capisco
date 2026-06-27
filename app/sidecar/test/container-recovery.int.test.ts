/**
 * Container crash recovery (road-to-real-runtime P4 — "Container gekillt:
 * Health-Erkennung → Neustart-Angebot"). Adversarial + LIVE: bring a real
 * devcontainer up, KILL it from the outside (the crash), assert the health
 * signal flips to a non-running state, then restart it and assert it serves
 * commands again. Skips cleanly without docker + devcontainer.
 *
 * The autonomous half is detection + the restart MECHANISM; the "Neustart-
 * Angebot" (offer → human approval) is the broker/UI gate on top, not auto-fired.
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { containerStatus } from "../runtime/docker-exec.ts";
import {
  devcontainerUp,
  execInContainer,
  removeContainersByLabel,
  startContainer,
} from "../runtime/devcontainer-exec.ts";

const exec = promisify(execFile);

function which(cmd: string): boolean {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir && existsSync(join(dir, cmd))) return true;
  }
  return false;
}

const live = which("docker") && which("devcontainer");
const runLive = live ? it : it.skip;
const LABEL = "capisco.container-recovery-test=1";

describe("container crash recovery ↔ real Docker", () => {
  let dir: string;

  beforeAll(() => {
    if (!live) return;
    dir = mkdtempSync(join(tmpdir(), "capisco-recover-"));
    mkdirSync(join(dir, ".devcontainer"), { recursive: true });
    writeFileSync(
      join(dir, ".devcontainer", "devcontainer.json"),
      JSON.stringify({ name: "capisco-recover", image: "alpine:3.20" }),
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
    "detects an externally-killed container and recovers it via restart",
    async () => {
      const up = await devcontainerUp(dir, { idLabel: LABEL });
      expect(await containerStatus(up.containerId)).toBe("running");

      // Adversarial: the container dies from the outside.
      await exec("docker", ["kill", up.containerId]);

      // Health detection flips off "running" — the signal a recovery flow watches.
      const downState = await containerStatus(up.containerId);
      expect(downState).not.toBe("running");
      expect(["exited", "absent"]).toContain(downState);

      // Restart (the recovery action) brings it back, and it serves commands again.
      await startContainer(up.containerId);
      expect(await containerStatus(up.containerId)).toBe("running");
      const out = await execInContainer(up.containerId, ["echo", "recovered"]);
      expect(out.trim()).toBe("recovered");
    },
    300_000,
  );
});
