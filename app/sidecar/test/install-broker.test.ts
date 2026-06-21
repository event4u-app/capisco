// @vitest-environment node
/**
 * Broker-gated install test (B8 P1). Proves the install is a CONSEQUENTIAL,
 * human-gated, audited capability — never silent, never auto. Hermetic: the
 * install command is a FAKE runner (no real install) for the gate-logic cases,
 * and a real DRY/echo command through the real `runInstall` primitive to verify
 * the end-to-end wiring without installing anything.
 *
 *  - cleared gate → the command runs, append-only audit has the `executed`
 *    entry, outcome `installed:true`;
 *  - deny-all gate → NO command runs, NO `executed` audit, `installed:false`;
 *  - a `sudo`-prefixed install is broker-DENIED outright (default denylist) →
 *    no command, `installed:false`;
 *  - a failed command → `installed:false` with a reason (never a silent ok);
 *  - real DRY/echo command via the real primitive → end-to-end through the
 *    broker, installs nothing.
 */

import { describe, expect, it } from "vitest";
import type { AuditEntry } from "@/contracts";
import { Broker } from "../broker/capability-broker.ts";
import { BrokerInstaller } from "../provision/install-broker.ts";
import { ACP_BRIDGE_INSTALL_COMMAND } from "../provision/backend-provisioner.ts";

const BRIDGE_ARGV = [...ACP_BRIDGE_INSTALL_COMMAND];

function executed(broker: Broker): AuditEntry[] {
  return broker.audit.list().filter((e) => e.outcome === "executed");
}

describe("broker-gated installer — never silent, always audited", () => {
  it("runs the exact install command when the human clears the gate, and audits it", async () => {
    const broker = new Broker();
    const ran: string[][] = [];
    const installer = new BrokerInstaller({
      broker,
      resolvePermission: () => ({ axis: "session" }),
      runner: (argv) => {
        ran.push([...argv]);
        return Promise.resolve({ ok: true, code: 0, stdout: "", stderr: "" });
      },
    });

    const outcome = await installer.install(BRIDGE_ARGV);

    expect(outcome.installed).toBe(true);
    expect(outcome.auditedTarget).toBe("npm i -g @zed-industries/claude-code-acp");
    // The exact argv ran — never re-parsed as a shell string.
    expect(ran).toEqual([BRIDGE_ARGV]);
    // Append-only audit recorded the EXECUTED install (before the command ran).
    const ex = executed(broker);
    expect(ex.length).toBe(1);
    expect(ex[0].capability).toBe("shell");
    expect(ex[0].target).toBe("npm i -g @zed-industries/claude-code-acp");
  });

  it("runs NOTHING and writes NO executed audit when the gate is denied (fail-closed)", async () => {
    const broker = new Broker();
    let ranCount = 0;
    const installer = new BrokerInstaller({
      broker,
      resolvePermission: () => ({ axis: "deny" }),
      runner: () => {
        ranCount += 1;
        return Promise.resolve({ ok: true, code: 0, stdout: "", stderr: "" });
      },
    });

    const outcome = await installer.install(BRIDGE_ARGV);
    expect(outcome.installed).toBe(false);
    expect(outcome.reason).toBeTruthy();
    expect(ranCount).toBe(0);
    expect(executed(broker).length).toBe(0);
  });

  it("defaults to deny-all (no resolver) — no install without an explicit human OK", async () => {
    const broker = new Broker();
    let ranCount = 0;
    const installer = new BrokerInstaller({
      broker,
      runner: () => {
        ranCount += 1;
        return Promise.resolve({ ok: true, code: 0, stdout: "", stderr: "" });
      },
    });
    const outcome = await installer.install(BRIDGE_ARGV);
    expect(outcome.installed).toBe(false);
    expect(ranCount).toBe(0);
  });

  it("DENIES a sudo-prefixed install outright (default denylist) — no command runs", async () => {
    const broker = new Broker();
    let ranCount = 0;
    const installer = new BrokerInstaller({
      broker,
      // Even a clearing resolver cannot rescue a denylisted command — the broker
      // returns `deny` before the gate is consulted.
      resolvePermission: () => ({ axis: "session" }),
      runner: () => {
        ranCount += 1;
        return Promise.resolve({ ok: true, code: 0, stdout: "", stderr: "" });
      },
    });
    const outcome = await installer.install(["sudo", "npm", "i", "-g", "whatever"]);
    expect(outcome.installed).toBe(false);
    expect(outcome.reason).toContain("denied");
    expect(ranCount).toBe(0);
    expect(executed(broker).length).toBe(0);
  });

  it("reports installed:false with a reason when the command fails (never a silent ok)", async () => {
    const broker = new Broker();
    const installer = new BrokerInstaller({
      broker,
      resolvePermission: () => ({ axis: "session" }),
      runner: () =>
        Promise.resolve({ ok: false, code: 1, stdout: "", stderr: "E404 not found" }),
    });
    const outcome = await installer.install(BRIDGE_ARGV);
    expect(outcome.installed).toBe(false);
    expect(outcome.reason).toContain("failed");
    expect(outcome.reason).toContain("E404");
  });

  it("verifies the end-to-end wiring with a real DRY/echo command (installs nothing)", async () => {
    const broker = new Broker();
    // The real installer (real `runInstall` primitive) — but the command is a
    // harmless `echo`, so the path is exercised end-to-end without installing.
    const installer = new BrokerInstaller({
      broker,
      resolvePermission: () => ({ axis: "session" }),
    });
    const dry = ["echo", "npm", "i", "-g", "@zed-industries/claude-code-acp"];
    const outcome = await installer.install(dry);
    expect(outcome.installed).toBe(true);
    expect(outcome.auditedTarget).toBe("echo npm i -g @zed-industries/claude-code-acp");
    expect(executed(broker).length).toBe(1);
  });

  it("rejects an empty install command without touching the broker", async () => {
    const broker = new Broker();
    const installer = new BrokerInstaller({ broker, resolvePermission: () => ({ axis: "session" }) });
    const outcome = await installer.install([]);
    expect(outcome.installed).toBe(false);
    expect(executed(broker).length).toBe(0);
  });
});
