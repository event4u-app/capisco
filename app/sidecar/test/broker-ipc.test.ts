/**
 * Broker-over-IPC integration test (B4). Proves the capability broker is
 * reachable over the real socket spine (client proxy → socket → registry →
 * BrokerProvider), and — critically — that the secret VALUE path is NOT on the
 * wire. Only the reference-name + decision + audit surface crosses the socket.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Sidecar } from "../server/sidecar.ts";
import { registerBroker, BROKER_PROVIDER_ID } from "../register-broker.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { SocketClientTransport } from "../client/socket-client-transport.ts";
import type { Broker } from "../broker/index.ts";
import type { AuditEntry, BrokerDecision, GrantAxis, Principal } from "@/contracts";

let dir: string;
let sidecar: Sidecar;
let socketPath: string;
let broker: Broker;

const agent: Principal = { id: "a1", kind: "agent", label: "Opus" };

async function connect(): Promise<SidecarClient> {
  const transport = await SocketClientTransport.connect(socketPath);
  return new SidecarClient(transport);
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "capisco-broker-"));
  socketPath = join(dir, ".sidecar.sock");
  sidecar = new Sidecar({ socketPath });
  broker = registerBroker(sidecar.registry);
  await sidecar.listen();
});

afterEach(async () => {
  await sidecar.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("broker served over the IPC spine", () => {
  it("registers the broker provider", () => {
    expect(sidecar.registry.list()).toContain(BROKER_PROVIDER_ID);
  });

  it("authorizes a read-only capability over the socket", async () => {
    const client = await connect();
    const decision = (await client.call(BROKER_PROVIDER_ID, "authorize", [
      agent,
      { kind: "shell", target: "git status" },
    ])) as BrokerDecision;
    expect(decision.outcome).toBe("allow");
    client.close();
  });

  it("asks (returns a PermissionRequest) for a mutating capability", async () => {
    const client = await connect();
    const decision = (await client.call(BROKER_PROVIDER_ID, "authorize", [
      agent,
      { kind: "file-write", target: "src/x.ts" },
    ])) as BrokerDecision;
    expect(decision.outcome).toBe("ask");
    expect(decision.request).toBeDefined();
    client.close();
  });

  it("resolves a grant over the return channel", async () => {
    const client = await connect();
    const axis = (await client.call(BROKER_PROVIDER_ID, "resolve", [
      agent,
      { kind: "file-write", target: "src/x.ts" },
      { axis: "session" },
    ])) as GrantAxis;
    expect(axis).toBe("session");
    // The grant is now persisted server-side: re-authorize allows.
    const decision = (await client.call(BROKER_PROVIDER_ID, "authorize", [
      agent,
      { kind: "file-write", target: "src/x.ts" },
    ])) as BrokerDecision;
    expect(decision.outcome).toBe("allow");
    client.close();
  });

  it("listSecretRefs returns reference NAMES only — never values, over the wire", async () => {
    // Put a secret server-side (the in-process consumer owns the value path).
    broker.secrets.put("prod-readonly", "TOP-SECRET-WIRE-VALUE");
    const client = await connect();
    const refs = (await client.call(BROKER_PROVIDER_ID, "listSecretRefs", [])) as string[];
    expect(refs).toContain("prod-readonly");
    // The value never crossed the socket.
    expect(JSON.stringify(refs)).not.toContain("TOP-SECRET-WIRE-VALUE");
    client.close();
  });

  it("the secret VALUE method is NOT exposed on the wire", async () => {
    const client = await connect();
    // There is no `inject` / `getSecret` RPC — calling one is an unknown method.
    await expect(
      client.call(BROKER_PROVIDER_ID, "inject", ["prod-readonly"]),
    ).rejects.toThrow();
    await expect(
      client.call(BROKER_PROVIDER_ID, "getSecret", ["prod-readonly"]),
    ).rejects.toThrow();
    client.close();
  });

  it("listAudit returns the append-only log over the wire (names, not values)", async () => {
    broker.secrets.put("staging-admin", "WIRE-LEAK-CHECK");
    const client = await connect();
    await client.call(BROKER_PROVIDER_ID, "authorize", [
      agent,
      { kind: "secret-read", target: "x", credentialRef: "staging-admin" },
    ]);
    const log = (await client.call(BROKER_PROVIDER_ID, "listAudit", [])) as AuditEntry[];
    expect(log.length).toBeGreaterThanOrEqual(1);
    const dump = JSON.stringify(log);
    expect(dump).toContain("staging-admin"); // reference name is fine
    expect(dump).not.toContain("WIRE-LEAK-CHECK"); // value is not
    client.close();
  });
});
