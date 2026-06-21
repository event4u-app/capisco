/**
 * Session-store-over-IPC integration test (B3). Proves the persistent session
 * store is reachable over the real socket spine (client proxy → socket →
 * registry → SessionStore), so the UI reads resume/search/branch through the
 * exact wire the desktop shell uses — not just in-process.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Sidecar } from "../server/sidecar.ts";
import { registerBroker } from "../register-broker.ts";
import { registerSession, SESSION_PROVIDER_ID } from "../register-session.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { SocketClientTransport } from "../client/socket-client-transport.ts";
import type { ResumedSession, SessionSearchHit, StoredSession, TranscriptBlock } from "@/contracts";

let dir: string;
let sidecar: Sidecar;
let socketPath: string;

function msg(id: string, body: string): TranscriptBlock {
  return { type: "message", block: { id, role: "user", body } };
}

async function connect(): Promise<SidecarClient> {
  const transport = await SocketClientTransport.connect(socketPath);
  return new SidecarClient(transport);
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "capisco-session-"));
  socketPath = join(dir, ".sidecar.sock");
  sidecar = new Sidecar({ socketPath });
  const broker = registerBroker(sidecar.registry);
  registerSession(sidecar.registry, broker);
  await sidecar.listen();
});

afterEach(async () => {
  await sidecar.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("session store served over the IPC spine", () => {
  it("registers the session provider", () => {
    expect(sidecar.registry.list()).toContain(SESSION_PROVIDER_ID);
  });

  it("create → append → resume round-trips over the socket", async () => {
    const client = await connect();
    const created = (await client.call(SESSION_PROVIDER_ID, "create", [
      { model: "Opus 4.8", title: "Wire run" },
    ])) as StoredSession;
    expect(created.id).toBeTruthy();

    await client.call(SESSION_PROVIDER_ID, "append", [created.id, msg("m1", "hello over the wire")]);
    const resumed = (await client.call(SESSION_PROVIDER_ID, "resume", [created.id])) as ResumedSession;
    expect(resumed.blocks.map((b) => b.block.id)).toEqual(["m1"]);
    expect(resumed.tree.activeLeaf).toBe("m1");
    client.close();
  });

  it("search is reachable over the wire", async () => {
    const client = await connect();
    const s = (await client.call(SESSION_PROVIDER_ID, "create", [
      { model: "Opus 4.8", title: "Search me" },
    ])) as StoredSession;
    await client.call(SESSION_PROVIDER_ID, "append", [s.id, msg("m1", "the broker chokepoint")]);
    const hits = (await client.call(SESSION_PROVIDER_ID, "search", ["chokepoint"])) as SessionSearchHit[];
    expect(hits.map((h) => h.sessionId)).toContain(s.id);
    client.close();
  });

  it("retry-as-branch over the wire forks a sibling, never overwrites", async () => {
    const client = await connect();
    const s = (await client.call(SESSION_PROVIDER_ID, "create", [
      { model: "Opus 4.8", title: "Branch run" },
    ])) as StoredSession;
    await client.call(SESSION_PROVIDER_ID, "append", [s.id, msg("m1", "first answer")]);
    const branchId = (await client.call(SESSION_PROVIDER_ID, "retryAsBranch", [s.id, "m1", "retry"])) as string;
    const resumed = (await client.call(SESSION_PROVIDER_ID, "resume", [s.id])) as ResumedSession;
    expect(resumed.tree.nodes["m1"].children).toContain(branchId);
    expect(resumed.tree.activeLeaf).toBe(branchId);
    client.close();
  });
});
