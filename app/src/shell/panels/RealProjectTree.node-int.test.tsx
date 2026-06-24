import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { createPipePair } from "@/lib/sidecar/protocol/transport";
import { ProviderRegistry } from "../../../sidecar/registry/registry.ts";
import { IpcConnection } from "../../../sidecar/server/ipc-server.ts";
import { registerMockProviders } from "../../../sidecar/register-mocks.ts";
import { registerDevWorkspace } from "../../../sidecar/register-dev-workspace.ts";
import { clearSidecarBridge, installSidecarBridge } from "@/lib/desktop-shell";
import { useOpenProject } from "@/shell/open-project-store";
import { useEditor } from "@/shell/editor/store";
import { ExplorerPanel } from "./ExplorerPanel";
import { EditorWorkspace } from "@/shell/editor/EditorWorkspace";

/**
 * NOTE: `*.node-int.test.tsx` is excluded from `tsconfig.app.json` (the
 * browser-typed app project) because it deliberately bridges the browser and
 * node worlds at RUNTIME — it renders React (DOM) while standing up a real
 * sidecar registry over node builtins (`node:fs`, `child_process`). vitest runs
 * it under jsdom (which provides both DOM globals and node builtins); the app
 * tsc project stays browser-pure. It is verified green by the vitest gate.
 *
 * Phase 1 UI integration test (road-to-runnable-dev). Drives the real Explorer
 * against a temp git repo over the IPC spine (in-process pipe → IpcConnection →
 * real fs provider): open a project by path → real on-disk tree with git
 * markers → click a file → REAL content loads into the editor. The mock
 * fallback (no bridge) is exercised by the other Explorer/visual specs.
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
  repoDir = mkdtempSync(join(tmpdir(), "capisco-ui-"));
  writeRepoFile("README.md", "# temp\n");
  writeRepoFile("src/app.ts", "export const answer = 42;\n");
  gitInit(repoDir);
  // Dirty a tracked file so the tree shows a real git marker.
  writeRepoFile("README.md", "# temp\nchanged\n");

  // Wire a real sidecar (mocks + the real fs/git swap) over an in-process pipe,
  // then install it as the desktop bridge so getProviders() routes to real IPC.
  const { a: clientSide, b: serverSide } = createPipePair();
  const registry = new ProviderRegistry();
  registerMockProviders(registry);
  registerDevWorkspace(registry); // real fs provider, path-keyed
  new IpcConnection(serverSide, registry);
  installSidecarBridge(clientSide);

  // Reset stores so each test starts with no open project / clean editor.
  useOpenProject.setState({ project: null, tree: [], loading: false, error: null });
  useEditor.setState({ realDocs: {} });
});

afterEach(() => {
  clearSidecarBridge();
  useOpenProject.getState().close();
  rmSync(repoDir, { recursive: true, force: true });
});

function renderExplorer() {
  return render(
    <ThemeProvider>
      <ExplorerPanel />
    </ThemeProvider>,
  );
}

describe("Explorer — real opened project (P1)", () => {
  it("falls back to the mock-driven tree before any project is opened", () => {
    renderExplorer();
    expect(screen.getByTestId("explorer-tree")).toBeInTheDocument();
    expect(screen.getByTestId("explorer-project-core")).toBeInTheDocument();
    expect(screen.queryByTestId("real-project-tree")).not.toBeInTheDocument();
  });

  it("opens a real project by path and renders the live on-disk tree with git markers", async () => {
    const user = userEvent.setup();
    renderExplorer();

    // Reveal the open bar, type the temp repo path, open it.
    await user.click(screen.getByTestId("explorer-panel").querySelector("button")!);
    const input = await screen.findByTestId("open-project-input");
    await user.type(input, repoDir);
    await user.click(screen.getByTestId("open-project-submit"));

    // Real tree appears; the mock tree is gone.
    const tree = await screen.findByTestId("real-project-tree");
    await waitFor(() =>
      expect(within(tree).getByTestId("real-file-README.md")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("explorer-tree")).not.toBeInTheDocument();
    expect(within(tree).getByTestId("real-file-src")).toBeInTheDocument();

    // The dirtied tracked file shows a real "M" git marker.
    expect(within(tree).getByTestId("real-file-README.md")).toHaveTextContent("M");
  });

  it("loads REAL file content into the editor when a file is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ExplorerPanel />
        <EditorWorkspace />
      </ThemeProvider>,
    );

    await user.click(screen.getByTestId("explorer-panel").querySelector("button")!);
    await user.type(await screen.findByTestId("open-project-input"), repoDir);
    await user.click(screen.getByTestId("open-project-submit"));

    // The tree starts fully expanded; click src/app.ts directly.
    const tree = await screen.findByTestId("real-project-tree");
    const file = await within(tree).findByTestId("real-file-src/app.ts");
    await user.click(file);

    // The editor store now carries the REAL content.
    await waitFor(() => {
      const realDocs = useEditor.getState().realDocs;
      expect(realDocs["src/app.ts"]?.text).toBe("export const answer = 42;\n");
    });
    expect(useEditor.getState().activeFile).toBe("src/app.ts");
  });
});
