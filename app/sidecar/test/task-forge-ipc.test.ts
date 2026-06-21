/**
 * B6 Phase 0 — Task/Forge providers served over the REAL IPC spine (socket →
 * registry → fixture provider). Proves the read-only surface serialises over
 * the wire exactly like every other provider; a real adapter is a transport
 * swap behind the same wire ids.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { Sidecar } from "../server/sidecar.ts";
import { registerTaskForge, TASK_PROVIDER_ID, FORGE_PROVIDER_ID } from "../register-task-forge.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { SocketClientTransport } from "../client/socket-client-transport.ts";
import type { Ticket, WhoseTurnEntry } from "@/contracts";

let sidecar: Sidecar;
let socketPath: string;

async function connect(): Promise<SidecarClient> {
  const transport = await SocketClientTransport.connect(socketPath);
  return new SidecarClient(transport);
}

beforeEach(async () => {
  socketPath = join(mkdtempSync(join(tmpdir(), "capisco-tfsock-")), ".sidecar.sock");
  sidecar = new Sidecar({ socketPath });
  registerTaskForge(sidecar.registry);
  await sidecar.listen();
});

afterEach(async () => {
  await sidecar.close();
});

describe("Task/Forge fixture providers over the IPC spine", () => {
  it("registers both providers", () => {
    const ids = sidecar.registry.list();
    expect(ids).toContain(TASK_PROVIDER_ID);
    expect(ids).toContain(FORGE_PROVIDER_ID);
  });

  it('answers "my tickets" over the socket', async () => {
    const client = await connect();
    const mine = (await client.call(TASK_PROVIDER_ID, "myTickets", [])) as Ticket[];
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((t) => t.who === "you")).toBe(true);
    client.close();
  });

  it('answers "next from sprint" over the socket', async () => {
    const client = await connect();
    const next = (await client.call(TASK_PROVIDER_ID, "nextFromSprint", [])) as Ticket;
    expect(next.id).toBe("CAP-167");
    client.close();
  });

  it('answers "whose turn" over the socket', async () => {
    const client = await connect();
    const turns = (await client.call(FORGE_PROVIDER_ID, "whoseTurn", [])) as WhoseTurnEntry[];
    expect(turns.length).toBeGreaterThan(0);
    const reasons = new Set(turns.map((t) => t.reason));
    expect(reasons.has("review-requested")).toBe(true);
    expect(reasons.has("changes-requested")).toBe(true);
    client.close();
  });

  it("serves the linear/gitlab fixtures when registered with them", async () => {
    await sidecar.close();
    socketPath = join(mkdtempSync(join(tmpdir(), "capisco-tfsock2-")), ".sidecar.sock");
    sidecar = new Sidecar({ socketPath });
    registerTaskForge(sidecar.registry, { task: "linear", forge: "gitlab" });
    await sidecar.listen();
    const client = await connect();
    const mine = (await client.call(TASK_PROVIDER_ID, "myTickets", [])) as Ticket[];
    expect(mine.every((t) => t.who === "mara")).toBe(true);
    client.close();
  });
});
