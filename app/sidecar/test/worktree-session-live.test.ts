// @vitest-environment node
/**
 * Worktree + Session live spine (road-to-runnable-dev P3). Proves, hermetically
 * against a temp git repo over the IPC spine, the full P3 vertical slice:
 *
 *  1. Create a REAL git worktree for the open repo over `worktree-ops` (browser
 *     IPC client → in-process pipe → RealWorktreeProvider → `git worktree add`).
 *  2. Start a persistent session COUPLED to that worktree over `session`.
 *  3. Run ToDo→agent (broker-gated stub ACP) in that REAL worktree — the agent's
 *     file actions flow through the broker chokepoint; a human-cleared run
 *     reaches `done`, streaming into the resumable session store.
 *
 * The session-start + ToDo run are wired with an explicit human-clearing
 * resolver (representing the user approving the run); the dev bridge itself
 * defaults to fail-closed (a real UI swaps a prompt resolver). No LLM key, no
 * real agent — the deterministic stub.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createPipePair } from "@/lib/sidecar/protocol/transport";
import { ProviderRegistry } from "../registry/registry.ts";
import { IpcConnection } from "../server/ipc-server.ts";
import { registerMockProviders } from "../register-mocks.ts";
import { registerBroker } from "../register-broker.ts";
import { registerSession, SESSION_PROVIDER_ID, TODO_PROVIDER_ID } from "../register-session.ts";
import { registerDevWorkspace } from "../register-dev-workspace.ts";
import { WORKTREE_PROVIDER_ID } from "../register-git.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { makeTempRepo, type TempRepo } from "./git-temp-repo.ts";
import type { GitWorktreeEntry, StoredSession, TodoItem, TodoView } from "@/contracts";

let repo: TempRepo;
let client: SidecarClient;
let teardown: () => void;

/**
 * Build a real registry (mocks + broker + the real worktree swap + a session
 * provider with a human-clearing resolver) over an in-process pipe, and a
 * browser-side IPC client onto it.
 */
function wire(): void {
  const { a: clientSide, b: serverSide } = createPipePair();
  const registry = new ProviderRegistry();
  registerMockProviders(registry);
  const broker = registerBroker(registry);
  // A human-clearing resolver — the user approving the ToDo run (the dev bridge
  // defaults to fail-closed; here we exercise the cleared path).
  registerSession(registry, broker, { resolvePermission: () => ({ axis: "session" }) });
  registerDevWorkspace(registry, { broker }); // real worktree-ops, path-keyed
  const conn = new IpcConnection(serverSide, registry);
  client = new SidecarClient(clientSide);
  teardown = () => {
    client.close();
    void conn;
  };
}

beforeEach(() => {
  repo = makeTempRepo();
  repo.write("README.md", "# temp\n");
  repo.commitAll("init");
  wire();
});

afterEach(() => {
  teardown();
  repo.cleanup();
});

describe("worktree + session live spine (P3)", () => {
  it("creates a real worktree for the open repo over the IPC spine", async () => {
    const path = join(repo.dir, ".capisco-worktrees", "feature-x");
    const made = (await client.call(WORKTREE_PROVIDER_ID, "create", [
      repo.dir,
      path,
      { branch: "feature-x", newBranch: true },
    ])) as GitWorktreeEntry;
    expect(made.branch).toBe("feature-x");
    expect(existsSync(path)).toBe(true);

    const list = (await client.call(WORKTREE_PROVIDER_ID, "list", [repo.dir])) as GitWorktreeEntry[];
    expect(list).toHaveLength(2);
    expect(list[0].isMain).toBe(true);
    expect(list.some((w) => w.branch === "feature-x")).toBe(true);
  });

  it("starts a session coupled to a real worktree over the IPC spine", async () => {
    const path = join(repo.dir, ".capisco-worktrees", "run-1");
    await client.call(WORKTREE_PROVIDER_ID, "create", [
      repo.dir,
      path,
      { branch: "run-1", newBranch: true, sessionId: "pending" },
    ]);

    const session = (await client.call(SESSION_PROVIDER_ID, "create", [
      { model: "Stub Agent", title: "Work here", status: "running", worktreePath: path },
    ])) as StoredSession;
    expect(session.worktreePath).toBe(path);
    expect(session.status).toBe("running");

    const stored = (await client.call(SESSION_PROVIDER_ID, "get", [session.id])) as StoredSession;
    expect(stored.worktreePath).toBe(path);
  });

  it("runs ToDo→agent (broker-gated stub) in a real worktree → done", async () => {
    // Create the real worktree the run will act in.
    const path = join(repo.dir, ".capisco-worktrees", "todo-run");
    await client.call(WORKTREE_PROVIDER_ID, "create", [
      repo.dir,
      path,
      { branch: "todo-run", newBranch: true },
    ]);

    const markdown = "# Plan\n\n- [ ] Wire the live worktree spine\n";
    const items = (await client.call(TODO_PROVIDER_ID, "list", ["plan.md", markdown])) as TodoView[];
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("open");

    // Send the ToDo to the (stub) agent IN THE REAL WORKTREE. The agent's file
    // actions flow through the broker; the human-clearing resolver lets them run.
    const item: TodoItem = {
      id: items[0].id,
      text: items[0].text,
      checked: items[0].checked,
      line: items[0].line,
    };
    const sessionId = (await client.call(TODO_PROVIDER_ID, "sendToAgent", [item, path])) as string;
    expect(sessionId).toBeTruthy();

    // The session completed and is coupled to the real worktree.
    const stored = (await client.call(SESSION_PROVIDER_ID, "get", [sessionId])) as StoredSession;
    expect(stored.status).toBe("done");
    expect(stored.worktreePath).toBe(path);

    // The ToDo is now done, linked to the run.
    const after = (await client.call(TODO_PROVIDER_ID, "list", ["plan.md", markdown])) as TodoView[];
    expect(after[0].status).toBe("done");
    expect(after[0].sessionId).toBe(sessionId);
  });

  it("removes a worktree over the IPC spine", async () => {
    const path = join(repo.dir, ".capisco-worktrees", "temp-wt");
    await client.call(WORKTREE_PROVIDER_ID, "create", [
      repo.dir,
      path,
      { branch: "temp-wt", newBranch: true },
    ]);
    await client.call(WORKTREE_PROVIDER_ID, "remove", [repo.dir, path]);
    const after = (await client.call(WORKTREE_PROVIDER_ID, "list", [repo.dir])) as GitWorktreeEntry[];
    expect(after.some((w) => w.branch === "temp-wt")).toBe(false);
  });
});
