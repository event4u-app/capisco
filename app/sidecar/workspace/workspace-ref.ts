/**
 * Canonical workspace/worktree reference (road-to-actually-works P1).
 *
 * The council read-through flagged "four notions of the workspace" — worktree,
 * container root, LSP root, DAP root each carrying their own path identity →
 * drift. This is the ONE canonical path-identity helper they all consume.
 *
 * `canonicalPath` resolves symlinks (macOS `/var/…` → `/private/var/…`) so two
 * spellings of the same checkout collapse to one key — the same fix
 * RealWorktreeProvider already uses for session coupling, extracted here so PTY,
 * LSP, DAP and container-exec key off an identical canonicalization instead of
 * each rolling their own.
 *
 * Later phases attach their roots to a WorkspaceRef:
 *   - container root  → real-runtime P0 (devcontainer mount mapping)
 *   - lsp root        → actually-works P5 (per-worktree LSP)
 *   - dap root        → real-runtime P1 (xdebug path mapping)
 */

import { realpathSync } from "node:fs";
import { resolve } from "node:path";

/** Symlink-resolved absolute path; falls back to `resolve` for paths not on disk. */
export function canonicalPath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
}

/** Optional roots a later phase attaches to the same canonical worktree. */
export interface WorkspaceRoots {
  /** Path inside the devcontainer the worktree is mounted at (real-runtime P0). */
  readonly containerRoot?: string;
  /** Root the language server was initialised with (actually-works P5). */
  readonly lspRoot?: string;
  /** Root the debug adapter maps to (real-runtime P1). */
  readonly dapRoot?: string;
}

export interface WorkspaceRef extends WorkspaceRoots {
  /** The worktree checkout path as given. */
  readonly worktreePath: string;
  /** Canonical (symlink-resolved) key — the single identity all consumers share. */
  readonly key: string;
}

/** Build a canonical WorkspaceRef from a worktree path (+ optional attached roots). */
export function workspaceRef(worktreePath: string, roots: WorkspaceRoots = {}): WorkspaceRef {
  return {
    worktreePath,
    key: canonicalPath(worktreePath),
    containerRoot: roots.containerRoot,
    lspRoot: roots.lspRoot,
    dapRoot: roots.dapRoot,
  };
}

/** True when two paths point at the same checkout (after canonicalization). */
export function sameWorkspace(a: string, b: string): boolean {
  return canonicalPath(a) === canonicalPath(b);
}
