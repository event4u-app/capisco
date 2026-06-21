/**
 * Deterministic mock {@link ProjectFsProvider} (road-to-runnable-dev P1). The
 * browser/visual fallback for the real on-disk tree + file content. Grounded in
 * the existing Explorer worktree fixture + editor docs — no disk, no Date.now /
 * Math.random — so the Vite-only app and the Playwright visual specs stay fully
 * functional against mocks. The real swap is `sidecar/fs/real-fs-provider.ts`.
 */

import type {
  FileContent,
  FileWriteResult,
  FsTreeNode,
  OpenedProject,
  ProjectFsProvider,
} from "@/contracts";
import { mockWorktrees } from "./workspace";
import { editorSnapshot } from "./editor";

const PRIMARY = mockWorktrees[0];

/** A flat, deterministic tree derived from the primary worktree's file list. */
const MOCK_TREE: FsTreeNode[] = PRIMARY.files.map((f) => ({
  // The mock file list is already a pre-flattened depth model; rebuild a
  // synthetic relPath from the name + index so each node is uniquely keyed.
  relPath: f.name,
  name: f.name,
  ext: f.ext,
  depth: Math.max(0, f.depth - 1),
  isDir: f.ext === "dir",
  git: f.git,
}));

export const mockProjectFsProvider: ProjectFsProvider = {
  openProject: (path: string) =>
    Promise.resolve<OpenedProject>({
      path,
      name: PRIMARY.name,
      branch: PRIMARY.branch,
      isRepo: true,
    }),
  getTree: () => Promise.resolve(MOCK_TREE),
  readFile: (_path: string, relPath: string) => {
    const doc = editorSnapshot.getDoc(relPath);
    const content: FileContent = {
      relPath,
      ext: doc?.ext ?? relPath.split(".").pop() ?? "txt",
      text: doc?.text ?? `// ${relPath}\n`,
    };
    return Promise.resolve(content);
  },
  // Disk-free no-op: the browser/visual harness never writes to disk. A real
  // save is the dev-bridge `RealFsProvider`, which routes through the broker.
  writeFile: (_path: string, relPath: string) =>
    Promise.resolve<FileWriteResult>({
      written: false,
      relPath,
      reason: "mock provider — no disk write",
    }),
};
