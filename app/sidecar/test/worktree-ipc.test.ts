import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Sidecar } from "../server/sidecar.ts";
import { registerGitProviders, WORKTREE_PROVIDER_ID } from "../register-git.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { SocketClientTransport } from "../client/socket-client-transport.ts";
import { makeTempRepo, type TempRepo } from "./git-temp-repo.ts";
import type { GitWorktreeEntry } from "@/contracts";

let repo: TempRepo;
let sidecar: Sidecar;
let socketPath: string;

async function connect(): Promise<SidecarClient> {
  const transport = await SocketClientTransport.connect(socketPath);
  return new SidecarClient(transport);
}

beforeEach(async () => {
  repo = makeTempRepo();
  repo.write("README.md", "# temp\n");
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

describe("real git-worktree served over the IPC spine", () => {
  it("registers the worktree-ops provider", () => {
    expect(sidecar.registry.list()).toContain(WORKTREE_PROVIDER_ID);
  });

  it("creates + lists + removes a worktree over the socket", async () => {
    const client = await connect();
    const path = join(repo.dir, ".worktrees", "feat");
    const made = (await client.call(WORKTREE_PROVIDER_ID, "create", [
      repo.dir,
      path,
      { branch: "feature-x", newBranch: true, sessionId: "sess-9" },
    ])) as GitWorktreeEntry;
    expect(made.branch).toBe("feature-x");
    expect(made.sessionId).toBe("sess-9");
    expect(existsSync(path)).toBe(true);

    const list = (await client.call(WORKTREE_PROVIDER_ID, "list", [repo.dir])) as GitWorktreeEntry[];
    expect(list).toHaveLength(2);
    expect(list[0].isMain).toBe(true);

    await client.call(WORKTREE_PROVIDER_ID, "remove", [repo.dir, path]);
    const after = (await client.call(WORKTREE_PROVIDER_ID, "list", [repo.dir])) as GitWorktreeEntry[];
    expect(after).toHaveLength(1);
    client.close();
  });
});
