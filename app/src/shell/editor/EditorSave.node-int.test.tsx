import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { createPipePair } from "@/lib/sidecar/protocol/transport";
import { ProviderRegistry } from "../../../sidecar/registry/registry.ts";
import { IpcConnection } from "../../../sidecar/server/ipc-server.ts";
import { registerMockProviders } from "../../../sidecar/register-mocks.ts";
import { registerBroker } from "../../../sidecar/register-broker.ts";
import { registerDevWorkspace } from "../../../sidecar/register-dev-workspace.ts";
import { clearSidecarBridge, installSidecarBridge } from "@/lib/desktop-shell";
import { useOpenProject } from "@/shell/open-project-store";
import { useEditor } from "@/shell/editor/store";
import { ExplorerPanel } from "@/shell/panels/ExplorerPanel";
import { EditorWorkspace } from "./EditorWorkspace";

/**
 * NOTE: `*.node-int.test.tsx` is excluded from `tsconfig.app.json` (the
 * browser-typed app project). It deliberately bridges the browser and node
 * worlds at RUNTIME — it renders React (DOM) while standing up a real sidecar
 * registry over node builtins (`node:fs`, `child_process`). vitest runs it
 * under jsdom; the app tsc project stays browser-pure.
 *
 * Phase 2 UI integration test (road-to-runnable-dev). Drives the real editor
 * SAVE against a temp git repo over the IPC spine: open a project → click a
 * file → REAL content loads → edit the buffer → Save → the broker-gated write
 * changes the file ON DISK for real. The dev workspace wires a Save-clearing
 * resolver (trusted human intent), so the write reaches disk.
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

function read(rel: string): string {
  return readFileSync(join(repoDir, rel), "utf8");
}

beforeEach(() => {
  repoDir = mkdtempSync(join(tmpdir(), "capisco-save-"));
  writeRepoFile("src/app.ts", "export const answer = 42;\n");
  gitInit(repoDir);

  // Wire a real sidecar (mocks + broker + the real fs/git swap WITH the
  // broker-gated writer) over an in-process pipe, install it as the bridge.
  const { a: clientSide, b: serverSide } = createPipePair();
  const registry = new ProviderRegistry();
  registerMockProviders(registry);
  const broker = registerBroker(registry);
  registerDevWorkspace(registry, { broker });
  new IpcConnection(serverSide, registry);
  installSidecarBridge(clientSide);

  useOpenProject.setState({ project: null, tree: [], loading: false, error: null });
  useEditor.setState({ realDocs: {} });
});

afterEach(() => {
  clearSidecarBridge();
  useOpenProject.getState().close();
  rmSync(repoDir, { recursive: true, force: true });
});

async function openAndClickFile() {
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
  const tree = await screen.findByTestId("real-project-tree");
  const file = await within(tree).findByTestId("real-file-src/app.ts");
  await user.click(file);
  await waitFor(() => {
    expect(useEditor.getState().realDocs["src/app.ts"]?.text).toBe(
      "export const answer = 42;\n",
    );
  });
  return user;
}

describe("Editor save — broker-gated write to real disk (P2)", () => {
  it("edits the buffer, marks dirty, and saves the real file change to disk", async () => {
    const user = await openAndClickFile();

    // The Save bar appears for a real doc; clean → Save disabled, no dirty tag.
    expect(await screen.findByTestId("editor-save-bar")).toBeInTheDocument();
    expect(screen.getByTestId("editor-save")).toBeDisabled();
    expect(screen.queryByTestId("editor-dirty")).not.toBeInTheDocument();

    // Edit the buffer through the store (CM6 onChange → setRealDocText).
    useEditor.getState().setRealDocText("src/app.ts", "export const answer = 100;\n");

    // The tab is now dirty; the Save button enables.
    await waitFor(() => expect(screen.getByTestId("editor-dirty")).toBeInTheDocument());
    expect(screen.getByTestId("editor-save")).toBeEnabled();
    expect(useEditor.getState().tabs.find((t) => t.file === "src/app.ts")?.dirty).toBe(true);

    // Save → broker-gated write reaches disk for real.
    await user.click(screen.getByTestId("editor-save"));

    await waitFor(() => expect(screen.getByTestId("editor-saved")).toBeInTheDocument());
    expect(read("src/app.ts")).toBe("export const answer = 100;\n");

    // The tab is clean again (saved baseline advanced).
    expect(useEditor.getState().tabs.find((t) => t.file === "src/app.ts")?.dirty).toBe(false);
    expect(screen.queryByTestId("editor-dirty")).not.toBeInTheDocument();
  });

  it("a save with a deny-all broker leaves the file unchanged (gated)", async () => {
    // Re-wire the bridge with a deny-all writer for this case.
    clearSidecarBridge();
    const { a: clientSide, b: serverSide } = createPipePair();
    const registry = new ProviderRegistry();
    registerMockProviders(registry);
    const broker = registerBroker(registry);
    // No resolver passed in registerDevWorkspace would default to the
    // session-clearing dev resolver; here we want a DENY. Build the writer
    // manually via a deny-all resolver path: omit the broker so writes gate.
    registerDevWorkspace(registry, {}); // no broker → writes report gated
    void broker;
    new IpcConnection(serverSide, registry);
    installSidecarBridge(clientSide);
    useOpenProject.setState({ project: null, tree: [], loading: false, error: null });
    useEditor.setState({ realDocs: {} });

    const user = await openAndClickFile();
    const before = read("src/app.ts");

    useEditor.getState().setRealDocText("src/app.ts", "export const answer = 0;\n");
    await waitFor(() => expect(screen.getByTestId("editor-dirty")).toBeInTheDocument());
    await user.click(screen.getByTestId("editor-save"));

    // The save was gated — the inline gated marker shows and disk is unchanged.
    await waitFor(() => expect(screen.getByTestId("editor-save-gated")).toBeInTheDocument());
    expect(read("src/app.ts")).toBe(before);
    // The tab stays dirty (the buffer still diverges from disk).
    expect(useEditor.getState().tabs.find((t) => t.file === "src/app.ts")?.dirty).toBe(true);
  });
});
