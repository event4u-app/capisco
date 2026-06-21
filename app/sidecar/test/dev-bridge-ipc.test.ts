// @vitest-environment node
/**
 * Dev WebSocket bridge integration test (road-to-runnable-dev P0).
 *
 * Boots the REAL dev bridge against a temp git repo, connects a browser-side
 * IPC client over the {@link WsClientTransport} (the same transport the Vite
 * dev entry injects), and verifies the client reaches REAL git + the REAL
 * project file tree end-to-end over the localhost WebSocket — exactly the path
 * `pnpm dev` exercises, minus Vite. No Tauri/cargo.
 *
 * The bridge binds 127.0.0.1 only; the test connects to that loopback address.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startDevBridge, DEV_BRIDGE_HOST, type DevBridge } from "../dev-bridge/main.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { WsClientTransport } from "@/lib/sidecar/client/ws-client-transport.ts";
import { GITOPS_PROVIDER_ID } from "../register-git.ts";
import { makeTempRepo, type TempRepo } from "./git-temp-repo.ts";
import type { FsTreeNode, GitStatus, OpenedProject } from "@/contracts";

let repo: TempRepo;
let bridge: DevBridge;

async function connect(): Promise<SidecarClient> {
  const transport = await WsClientTransport.connect(`ws://${DEV_BRIDGE_HOST}:${bridge.port}`);
  return new SidecarClient(transport);
}

beforeEach(async () => {
  repo = makeTempRepo();
  repo.write("a.txt", "one\ntwo\nthree\n");
  repo.write("src/app.ts", "export const x = 1;\n");
  repo.commitAll("init");
  // Port 0 → an ephemeral free port, so parallel test files never collide.
  bridge = await startDevBridge({ port: 0, repo: repo.dir });
});

afterEach(async () => {
  await bridge.close();
  repo.cleanup();
});

describe("dev WS bridge — browser IPC client reaches the real sidecar", () => {
  it("binds loopback only", () => {
    expect(bridge.port).toBeGreaterThan(0);
  });

  it("round-trips gitops.status against the live temp repo over the WebSocket", async () => {
    repo.write("a.txt", "one\nTWO\nthree\n");
    const client = await connect();
    const status = (await client.call(GITOPS_PROVIDER_ID, "status", [repo.dir])) as GitStatus;
    expect(status.branch).toBe("main");
    expect(status.entries.some((e) => e.path === "a.txt" && e.unstaged === "M")).toBe(true);
    client.close();
  });

  it("opens the real project + serves the real on-disk file tree with git markers", async () => {
    repo.write("a.txt", "one\nTWO\nthree\n");
    const client = await connect();

    const opened = (await client.call("projectFs", "openProject", [repo.dir])) as OpenedProject;
    expect(opened.isRepo).toBe(true);
    expect(opened.branch).toBe("main");

    const tree = (await client.call("projectFs", "getTree", [repo.dir])) as FsTreeNode[];
    // Real entries from disk: a.txt (modified marker), the src/ dir, src/app.ts.
    const aTxt = tree.find((n) => n.relPath === "a.txt");
    expect(aTxt?.git).toBe("M");
    expect(tree.some((n) => n.relPath === "src" && n.isDir)).toBe(true);
    expect(tree.some((n) => n.relPath === "src/app.ts" && !n.isDir)).toBe(true);
    // Directories sort before files at the root.
    expect(tree[0].isDir).toBe(true);
    client.close();
  });

  it("loads REAL file content for a clicked file (editor path)", async () => {
    const client = await connect();
    const content = (await client.call("projectFs", "readFile", [repo.dir, "src/app.ts"])) as {
      text: string;
      ext: string;
    };
    expect(content.text).toBe("export const x = 1;\n");
    expect(content.ext).toBe("ts");
    client.close();
  });

  it("refuses a path-traversal escape from the project root", async () => {
    const client = await connect();
    await expect(client.call("projectFs", "readFile", [repo.dir, "../../etc/passwd"])).rejects.toThrow();
    client.close();
  });
});
