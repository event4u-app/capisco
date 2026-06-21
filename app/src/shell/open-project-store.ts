import { create } from "zustand";
import type { FileContent, FileWriteResult, FsTreeNode, OpenedProject } from "@/contracts";
import { getProviders } from "@/lib/desktop-shell";

/**
 * Opened-project store (road-to-runnable-dev P1). Holds the real project the
 * user opened at runtime (via the Explorer path input or a recent-projects
 * entry) and its on-disk file tree, read through the `projectFs` provider.
 *
 * When no project is opened — the default, and ALWAYS the case in the
 * mock/visual harness (no bridge installed → getProviders() returns mocks and
 * nothing calls `open()`) — the Explorer renders its existing mock-driven view
 * unchanged, so the visual goldens stay byte-identical. Opening a project flips
 * the Explorer to the real tree and lets file clicks load real content.
 */

interface OpenProjectStore {
  /** The opened project, or null when none is open (mock-driven default). */
  project: OpenedProject | null;
  /** The real on-disk tree of the opened project. */
  tree: FsTreeNode[];
  /** True while a tree/content read is in flight. */
  loading: boolean;
  /** Last error message from an open/read, surfaced inline. */
  error: string | null;
  /** Open a project by absolute path: validates, then loads its tree. */
  open(path: string): Promise<void>;
  /** Clear the opened project, returning to the mock-driven default view. */
  close(): void;
  /** Read the REAL content of a tree file (for the editor). */
  readFile(relPath: string): Promise<FileContent>;
  /**
   * Save `text` to a tree file through the broker-gated write path (P2). A
   * gated/denied write resolves `{ written: false }` and changes nothing on
   * disk. Rejects when no project is open.
   */
  writeFile(relPath: string, text: string): Promise<FileWriteResult>;
}

export const useOpenProject = create<OpenProjectStore>((set, get) => ({
  project: null,
  tree: [],
  loading: false,
  error: null,
  open: async (path: string) => {
    const fs = getProviders().projectFs;
    set({ loading: true, error: null });
    try {
      const project = await fs.openProject(path);
      const tree = await fs.getTree(project.path);
      set({ project, tree, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : `failed to open ${path}`,
      });
    }
  },
  close: () => set({ project: null, tree: [], error: null }),
  readFile: (relPath: string) => {
    const { project } = get();
    if (!project) return Promise.reject(new Error("no project open"));
    return getProviders().projectFs.readFile(project.path, relPath);
  },
  writeFile: (relPath: string, text: string) => {
    const { project } = get();
    if (!project) return Promise.reject(new Error("no project open"));
    return getProviders().projectFs.writeFile(project.path, relPath, text);
  },
}));
