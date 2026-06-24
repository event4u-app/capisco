import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { createPipePair } from "@/lib/sidecar/protocol/transport";
import { ProviderRegistry } from "../../../sidecar/registry/registry.ts";
import { IpcConnection } from "../../../sidecar/server/ipc-server.ts";
import { registerMockProviders } from "../../../sidecar/register-mocks.ts";
import { registerBroker } from "../../../sidecar/register-broker.ts";
import { registerSession } from "../../../sidecar/register-session.ts";
import { registerDevWorkspace } from "../../../sidecar/register-dev-workspace.ts";
import { clearSidecarBridge, installSidecarBridge } from "@/lib/desktop-shell";
import { useOpenProject } from "@/shell/open-project-store";
import { useWorktrees } from "@/shell/worktree-store";
import { ExplorerPanel } from "./ExplorerPanel";

/**
 * NOTE: `*.node-int.test.tsx` is excluded from `tsconfig.app.json`. It bridges
 * the browser + node worlds at RUNTIME (renders React, stands up a real sidecar
 * registry over node builtins). vitest runs it under jsdom; the app tsc project
 * stays browser-pure.
 *
 * Phase 3 UI integration test (road-to-runnable-dev). Drives the live worktree
 * panel against a temp git repo over the IPC spine: open a project → the
 * worktree panel lists the live worktrees → create a NEW worktree (real
 * `git worktree add` on disk) → start a session. The mock fallback (no bridge)
 * is exercised by the other Explorer/visual specs (no project opened → no
 * panel).
 */

let repoDir: string;

function gitInit(dir: string): void {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Test Bot",
    GIT_AUTHOR_EMAIL: "bot@capisco.test",
    GIT_COMMITTER_NAME: "Test Bot",
    GIT_COMMITTER_EMAIL: "bot@capisco.test",
  };
  const run = (args: string[]): void => {
    execFileSync("git", ["-C", dir, ...args], { env, stdio: "ignore" });
  };
  run(["init", "-q", "-b", "main"]);
  run(["config", "user.name", "Test Bot"]);
  run(["config", "user.email", "bot@capisco.test"]);
  run(["config", "commit.gpgsign", "false"]);
  run(["add", "-A"]);
  run(["commit", "-q", "-m", "init"]);
}

function writeRepoFile(rel: string, content: string): void {
  const full = join(repoDir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
}

beforeEach(() => {
  repoDir = mkdtempSync(join(tmpdir(), "capisco-wt-"));
  writeRepoFile("README.md", "# temp\n");
  gitInit(repoDir);

  const { a: clientSide, b: serverSide } = createPipePair();
  const registry = new ProviderRegistry();
  registerMockProviders(registry);
  const broker = registerBroker(registry);
  registerSession(registry, broker, { resolvePermission: () => ({ axis: "session" }) });
  registerDevWorkspace(registry, { broker });
  new IpcConnection(serverSide, registry);
  installSidecarBridge(clientSide);

  useOpenProject.setState({ project: null, tree: [], loading: false, error: null });
  useWorktrees.setState({
    worktrees: [],
    activePath: "",
    busy: false,
    error: null,
    startedSessionId: null,
  });
});

afterEach(() => {
  clearSidecarBridge();
  useOpenProject.getState().close();
  rmSync(repoDir, { recursive: true, force: true });
});

async function openProject() {
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <ExplorerPanel />
    </ThemeProvider>,
  );
  await user.click(screen.getByTestId("explorer-panel").querySelector("button")!);
  await user.type(await screen.findByTestId("open-project-input"), repoDir);
  await user.click(screen.getByTestId("open-project-submit"));
  await screen.findByTestId("real-project-tree");
  return user;
}

describe("Worktree panel — live worktree create + session start (P3)", () => {
  it("lists the repo's main worktree once a project is open", async () => {
    await openProject();
    const panel = await screen.findByTestId("worktree-panel");
    await waitFor(() =>
      expect(within(panel).getByTestId("worktree-list").childElementCount).toBeGreaterThan(0),
    );
    // The main worktree (branch "main") is listed.
    expect(within(panel).getByTestId("worktree-item-main")).toBeInTheDocument();
  });

  it("creates a NEW real worktree on disk via the panel", async () => {
    const user = await openProject();
    const panel = await screen.findByTestId("worktree-panel");
    await waitFor(() =>
      expect(within(panel).getByTestId("worktree-item-main")).toBeInTheDocument(),
    );

    await user.type(within(panel).getByTestId("worktree-branch-input"), "feature-y");
    await user.click(within(panel).getByTestId("worktree-create"));

    // The new worktree appears in the list AND exists on disk for real.
    await waitFor(() =>
      expect(within(panel).getByTestId("worktree-item-feature-y")).toBeInTheDocument(),
    );
    expect(existsSync(join(repoDir, ".capisco-worktrees", "feature-y"))).toBe(true);
  });

  it("starts a session coupled to the active worktree", async () => {
    const user = await openProject();
    const panel = await screen.findByTestId("worktree-panel");
    await waitFor(() =>
      expect(within(panel).getByTestId("worktree-item-main")).toBeInTheDocument(),
    );

    await user.click(within(panel).getByTestId("worktree-start-session"));

    await waitFor(() =>
      expect(within(panel).getByTestId("worktree-session-started")).toBeInTheDocument(),
    );
    expect(useWorktrees.getState().startedSessionId).toBeTruthy();
  });
});
