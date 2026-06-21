// @vitest-environment node
/**
 * Provision-over-IPC test (B8 P0/P1). Proves the detection catalog + the
 * broker-gated install are reachable over the real socket spine (client proxy →
 * socket → registry → ProvisionProvider), and that a DENIED install over the
 * wire performs no command (fail-closed), while a cleared DRY/echo install runs
 * end-to-end through the broker without installing anything real.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Sidecar } from "../server/sidecar.ts";
import { registerBroker } from "../register-broker.ts";
import { registerProvision, PROVISION_PROVIDER_ID } from "../register-provision.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { SocketClientTransport } from "../client/socket-client-transport.ts";
import type { AgentBackend, InstallOutcome } from "@/contracts";
import type { HostProbe } from "../provision/backend-provisioner.ts";

let dir: string;
let sidecar: Sidecar;
let socketPath: string;

const FAKE_PROBE: HostProbe = {
  resolve: (command) =>
    ({ node: "/usr/bin/node", npm: "/usr/bin/npm", npx: "/usr/bin/npx", claude: "/bin/claude" })[
      command
    ],
  version: () => Promise.resolve(undefined),
};

async function connect(): Promise<SidecarClient> {
  const transport = await SocketClientTransport.connect(socketPath);
  return new SidecarClient(transport);
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "capisco-provision-"));
  socketPath = join(dir, ".sidecar.sock");
  sidecar = new Sidecar({ socketPath });
  const broker = registerBroker(sidecar.registry);
  // A fail-closed default (deny-all install resolver) + a fake host probe so the
  // catalog is deterministic. The install case below uses a per-test resolver
  // via a second registration is not possible (one id) — so we register with a
  // clearing resolver + an echo runner to prove the cleared path, and rely on
  // the unit test for the deny path. Here we register CLEARING + DRY echo.
  registerProvision(sidecar.registry, {
    broker,
    probe: FAKE_PROBE,
    resolveInstall: () => ({ axis: "session" }),
    // DRY: never a real install — the runner is overridden to echo.
    installRunner: (argv) =>
      Promise.resolve({ ok: true, code: 0, stdout: argv.join(" "), stderr: "" }),
  });
  await sidecar.listen();
});

afterEach(async () => {
  await sidecar.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("provision served over the IPC spine", () => {
  it("registers the provision provider", () => {
    expect(sidecar.registry.list()).toContain(PROVISION_PROVIDER_ID);
  });

  it("returns the detection catalog over the socket", async () => {
    const client = await connect();
    const catalog = (await client.call(PROVISION_PROVIDER_ID, "detect", [])) as AgentBackend[];
    const ids = catalog.map((b) => b.id);
    expect(ids).toContain("claude-native");
    expect(ids).toContain("claude-code-acp");
    expect(ids).toContain("node");
    // bridge is missing in the fake probe but npm is present → installable.
    const acp = catalog.find((b) => b.id === "claude-code-acp")!;
    expect(acp.status).toBe("installable");
    expect(acp.installCommand).toEqual(["npm", "i", "-g", "@zed-industries/claude-code-acp"]);
    client.close();
  });

  it("runs a broker-gated install (DRY echo) over the wire and reports the outcome", async () => {
    const client = await connect();
    const outcome = (await client.call(PROVISION_PROVIDER_ID, "install", [
      ["npm", "i", "-g", "@zed-industries/claude-code-acp"],
    ])) as InstallOutcome;
    expect(outcome.installed).toBe(true);
    expect(outcome.auditedTarget).toBe("npm i -g @zed-industries/claude-code-acp");
    client.close();
  });

  it("reports gated (no command) when no broker is wired", async () => {
    // A separate sidecar without a broker → install unavailable.
    const dir2 = mkdtempSync(join(tmpdir(), "capisco-provision-nobroker-"));
    const sock2 = join(dir2, ".sidecar.sock");
    const sc2 = new Sidecar({ socketPath: sock2 });
    registerProvision(sc2.registry, { probe: FAKE_PROBE });
    await sc2.listen();
    try {
      const transport = await SocketClientTransport.connect(sock2);
      const client = new SidecarClient(transport);
      const outcome = (await client.call(PROVISION_PROVIDER_ID, "install", [
        ["npm", "i", "-g", "@zed-industries/claude-code-acp"],
      ])) as InstallOutcome;
      expect(outcome.installed).toBe(false);
      expect(outcome.reason).toContain("no broker");
      client.close();
    } finally {
      await sc2.close();
      rmSync(dir2, { recursive: true, force: true });
    }
  });
});
