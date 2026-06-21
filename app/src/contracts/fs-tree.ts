/**
 * Project filesystem-tree contract (road-to-runnable-dev P1). The real Explorer
 * needs a recursive on-disk file tree (with git markers) and the editor needs
 * the real content of a clicked file. Both are **filesystem reads** — in the
 * real sidecar they flow through the broker-mediated fs execution primitive
 * (`sidecar/fs/fs-exec.ts`), never an ad-hoc `node:fs` call sprinkled in a
 * provider. The mock resolves deterministically (no disk) so the browser
 * fallback + the visual specs stay fully functional offline.
 *
 * Every method is keyed by the repo root `path` (mirrors `GitOpsProvider`'s
 * `cwd`-keyed surface) so a single provider instance can serve whichever
 * project the UI opens at runtime — no per-open re-registration.
 */

import type { FileNode } from "./workspace";

/** A node in the on-disk tree: a file or directory under the repo root. */
export interface FsTreeNode {
  /** Path relative to the repo root, POSIX-separated (e.g. "src/app.ts"). */
  relPath: string;
  /** Basename for display. */
  name: string;
  /** "dir" for directories, else the extension (icon hint), as {@link FileNode}. */
  ext: string;
  /** Nesting depth from the repo root (root children = 0). */
  depth: number;
  /** Whether this is a directory (expandable in the tree). */
  isDir: boolean;
  /** Git status marker for the file, when the working tree dirties it. */
  git?: FileNode["git"];
}

/** The opened-project handle the UI shows in the explorer header. */
export interface OpenedProject {
  /** Absolute repo root. */
  path: string;
  /** Display name (basename of the root). */
  name: string;
  /** Current branch, or "(no git)" when the path is not a git repo. */
  branch: string;
  /** Whether the path is a git working tree (markers available). */
  isRepo: boolean;
}

/**
 * The file content of one opened file plus the metadata the editor tab needs.
 */
export interface FileContent {
  /** Path relative to the repo root. */
  relPath: string;
  /** Extension (language/icon hint). */
  ext: string;
  /** The raw UTF-8 source. */
  text: string;
}

/** The outcome of an editor save through the broker-gated write path (P2). */
export interface FileWriteResult {
  /** True when the write reached disk. False when the broker gated/denied it. */
  written: boolean;
  /** Path relative to the repo root that was (or would have been) written. */
  relPath: string;
  /** Human-readable reason when `written` is false (audited gate reason). */
  reason?: string;
}

/**
 * Real-filesystem project provider (P1/P2). Reads are broker-mediated in the
 * real impl; the mock is deterministic and disk-free. WRITES (editor saves, P2)
 * flow through the capability broker's execution chokepoint in the real impl —
 * a denied write produces NO disk change. The mock's write is a no-op (the
 * browser/visual harness never touches disk).
 */
export interface ProjectFsProvider {
  /** Resolve + validate a repo root, returning its display metadata. */
  openProject(path: string): Promise<OpenedProject>;
  /**
   * Recursive file tree under `path` (directories first, alphabetical), with
   * git markers folded in from `git status`. Honours a sane ignore set
   * (`.git`, `node_modules`, build dirs) so the dev tree stays usable.
   */
  getTree(path: string): Promise<FsTreeNode[]>;
  /** Real UTF-8 content of `relPath` under the repo root `path`. */
  readFile(path: string, relPath: string): Promise<FileContent>;
  /**
   * Persist `text` to `relPath` under the repo root `path` (editor Save, P2).
   * In the real impl this is broker-gated: the disk write runs ONLY inside
   * `broker.execute` (the chokepoint), path-traversal-guarded. A gated/denied
   * write resolves `{ written: false }` and changes nothing on disk. The mock
   * is a disk-free no-op that reports `written: false`.
   */
  writeFile(path: string, relPath: string, text: string): Promise<FileWriteResult>;
}
