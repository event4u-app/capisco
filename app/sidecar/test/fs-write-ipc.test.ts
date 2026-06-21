// @vitest-environment node
/**
 * Editor-save over the IPC spine (road-to-runnable-dev P2). Boots the REAL dev
 * bridge against a temp git repo, connects a browser-side IPC client over the
 * {@link WsClientTransport} (the same transport the Vite dev entry injects), and
 * verifies `projectFs.writeFile` round-trips through the broker chokepoint to
 * REAL disk — exactly the path `pnpm dev` exercises for an editor save, minus
 * Vite. The dev bridge wires a `session`-clearing resolver (a Save is trusted
 * human intent), so the write reaches disk; a fresh read returns the new
 * content. No Tauri/cargo.
 *
 * The bridge binds 127.0.0.1 only; the test connects to that loopback address.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { startDevBridge, DEV_BRIDGE_HOST, type DevBridge } from "../dev-bridge/main.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { WsClientTransport } from "@/lib/sidecar/client/ws-client-transport.ts";
import { makeTempRepo, type TempRepo } from "./git-temp-repo.ts";
import type { FileContent, FileWriteResult } from "@/contracts";

let repo: TempRepo;
let bridge: DevBridge;

async function connect(): Promise<SidecarClient> {
  const transport = await WsClientTransport.connect(`ws://${DEV_BRIDGE_HOST}:${bridge.port}`);
  return new SidecarClient(transport);
}

beforeEach(async () => {
  repo = makeTempRepo();
  repo.write("src/app.ts", "export const x = 1;\n");
  repo.commitAll("init");
  // Port 0 → an ephemeral free port, so parallel test files never collide. The
  // dev bridge wires the broker-gated writer with a Save-clearing resolver.
  bridge = await startDevBridge({ port: 0, repo: repo.dir });
});

afterEach(async () => {
  await bridge.close();
  repo.cleanup();
});

function read(rel: string): string {
  return readFileSync(join(repo.dir, rel), "utf8");
}

describe("dev WS bridge — editor save reaches real disk through the broker", () => {
  it("writes a real file change over the WebSocket (broker-cleared save)", async () => {
    const client = await connect();
    const result = (await client.call("projectFs", "writeFile", [
      repo.dir,
      "src/app.ts",
      "export const x = 2;\n",
    ])) as FileWriteResult;

    expect(result.written).toBe(true);
    // The file changed on disk for real.
    expect(read("src/app.ts")).toBe("export const x = 2;\n");

    // A fresh read over the wire returns the saved content (round-trip).
    const content = (await client.call("projectFs", "readFile", [
      repo.dir,
      "src/app.ts",
    ])) as FileContent;
    expect(content.text).toBe("export const x = 2;\n");
    client.close();
  });

  it("refuses a path-traversal escape on write (no disk change)", async () => {
    const client = await connect();
    const result = (await client.call("projectFs", "writeFile", [
      repo.dir,
      "../../etc/capisco-pwned",
      "x\n",
    ])) as FileWriteResult;
    // The traversal guard throws inside the broker.execute callback → gated.
    expect(result.written).toBe(false);
    client.close();
  });
});
