import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { Sidecar } from "../server/sidecar.ts";
import { registerGitProviders, GITOPS_PROVIDER_ID } from "../register-git.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { SocketClientTransport } from "../client/socket-client-transport.ts";
import { makeTempRepo, TEMP_AUTHOR, type TempRepo } from "./git-temp-repo.ts";
import type { DiffDoc, GitLogEntry, GitStatus, Worktree } from "@/contracts";

let repo: TempRepo;
let sidecar: Sidecar;
let socketPath: string;

async function connect(): Promise<SidecarClient> {
  const transport = await SocketClientTransport.connect(socketPath);
  return new SidecarClient(transport);
}

beforeEach(async () => {
  repo = makeTempRepo();
  repo.write("a.txt", "one\ntwo\nthree\n");
  repo.commitAll("init");
  socketPath = join(repo.dir, ".sidecar.sock");
  sidecar = new Sidecar({ socketPath });
  registerGitProviders(sidecar.registry, { cwd: repo.dir, repoId: "core", repoName: "core" });
  await sidecar.listen();
});

afterEach(async () => {
  await sidecar.close();
  repo.cleanup();
});

describe("real git served over the IPC spine", () => {
  it("registers workspace + gitops providers", () => {
    expect(sidecar.registry.list()).toContain("workspace");
    expect(sidecar.registry.list()).toContain(GITOPS_PROVIDER_ID);
  });

  it("round-trips gitops.status against the live repo over the socket", async () => {
    repo.write("a.txt", "one\nTWO\nthree\n");
    const client = await connect();
    const status = (await client.call(GITOPS_PROVIDER_ID, "status", [repo.dir])) as GitStatus;
    expect(status.branch).toBe("main");
    expect(status.entries.some((e) => e.path === "a.txt" && e.unstaged === "M")).toBe(true);
    client.close();
  });

  it("round-trips workspace.getDiff projecting a real diff into a DiffDoc", async () => {
    repo.write("a.txt", "one\nTWO\nthree\nfour\n");
    const client = await connect();
    const doc = (await client.call("workspace", "getDiff", ["a.txt"])) as DiffDoc;
    expect(doc.file).toBe("a.txt");
    expect(doc.added).toBe(2);
    expect(doc.removed).toBe(1);
    expect(doc.rows.some((r) => r.k === "add" && r.r?.t === "TWO")).toBe(true);
    client.close();
  });

  it("performs a real write (stage→commit) over the wire and reads it back", async () => {
    const client = await connect();
    repo.write("b.txt", "new file\n");
    await client.call(GITOPS_PROVIDER_ID, "stage", [repo.dir, ["b.txt"]]);
    const res = (await client.call(GITOPS_PROVIDER_ID, "commit", [
      repo.dir,
      "add b",
      TEMP_AUTHOR,
    ])) as {
      ok: boolean;
      ref: string;
    };
    expect(res.ok).toBe(true);
    const log = (await client.call(GITOPS_PROVIDER_ID, "log", [repo.dir])) as GitLogEntry[];
    expect(log[0].subject).toBe("add b");
    expect(log[0].shortHash).toBe(res.ref);
    client.close();
  });

  it("workspace.listWorktrees reflects the live worktree path + branch", async () => {
    const client = await connect();
    const worktrees = (await client.call("workspace", "listWorktrees")) as Worktree[];
    expect(worktrees).toHaveLength(1);
    expect(worktrees[0].path).toBe(repo.dir);
    expect(worktrees[0].branch).toBe("main");
    client.close();
  });
});
