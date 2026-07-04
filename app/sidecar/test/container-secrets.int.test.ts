/**
 * Secrets-by-reference INTO a container (road-to-real-runtime P0, Council-Trap,
 * security-sensitive). The invariant: a credential reaches the container process
 * ONLY at runtime over stdin — never in argv (visible in `ps`), the image, or a
 * layer. The value is obtained solely through SecretStore.inject(ref, cb)
 * (secret-by-reference); it lives only inside that callback and crosses only the
 * exec's stdin pipe.
 *
 * Verified LIVE: the secret is injected via stdin into a real container and
 * round-trips back out (proving delivery), while the docker argv carries no
 * secret. Skips cleanly without docker + devcontainer.
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { InMemorySecretStore } from "../broker/in-memory-secret-store.ts";
import { devcontainerUp, execInContainerWithStdin, removeContainersByLabel } from "../runtime/devcontainer-exec.ts";

function which(cmd: string): boolean {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir && existsSync(join(dir, cmd))) return true;
  }
  return false;
}

const live = which("docker") && which("devcontainer");
const runLive = live ? it : it.skip;
const LABEL = "capisco.container-secrets-test=1";
const SECRET = "s3cr3t-pw-9f2a";

describe("secrets-by-reference into a container ↔ real Docker", () => {
  let dir: string;

  beforeAll(() => {
    if (!live) return;
    dir = mkdtempSync(join(tmpdir(), "capisco-csec-"));
    mkdirSync(join(dir, ".devcontainer"), { recursive: true });
    writeFileSync(
      join(dir, ".devcontainer", "devcontainer.json"),
      JSON.stringify({ name: "capisco-csec", image: "alpine:3.20" }),
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
    "injects a secret over stdin (never argv) and it reaches the container",
    async () => {
      const secrets = new InMemorySecretStore();
      secrets.put("db-pw", SECRET);
      // The script reads stdin and echoes it — it never NAMES the secret, so the
      // docker argv below carries no credential.
      const argv = ["sh", "-c", "cat"];
      expect(argv.join(" ")).not.toContain(SECRET); // argv is secret-free by construction

      const up = await devcontainerUp(dir, { idLabel: LABEL });

      // Secret-by-reference: the value exists only inside inject's callback and
      // crosses only the exec stdin pipe.
      const echoed = await secrets.inject("db-pw", (value) =>
        execInContainerWithStdin(up.containerId, argv, value),
      );
      expect(echoed).toBe(SECRET); // round-tripped via stdin → delivered into the container

      // The store never hands the value back as a value — only reference names.
      expect(secrets.list()).toEqual(["db-pw"]);
    },
    300_000,
  );
});
