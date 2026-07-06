/**
 * First-party filesystem WRITE primitive (road-to-runnable-dev P2).
 *
 * Security posture (mirrors `git/git-exec.ts` and `fs/fs-exec.ts`): this is the
 * single, allowlisted place `node:fs` WRITE calls live for editor file saves.
 * It is NOT an open-ended fs escape and is NEVER imported by a provider
 * directly — the ONLY caller is the broker-mediated perform adapter
 * (`fs-write-broker.ts`), which runs it inside `broker.execute`. A denied
 * capability never reaches this file, so a denied write produces no disk
 * change.
 *
 * The architecture/lint test (`broker-chokepoint.test.ts`) fails if `node:fs`
 * WRITE calls (`writeFile*`, `mkdir*`, `rename*`, `rm*`, `unlink*`, …) appear
 * in any sidecar file outside the allowlisted execution primitives. This file
 * is the audited home for editor writes; the recent-projects atomic write is
 * the only other one.
 *
 * Path-traversal guard: every write is resolved against the repo root and
 * rejected if it escapes it (reuses `safeResolve` from `fs-exec.ts`) — a
 * relative path can never write outside the opened project.
 */

import { writeFileSync, mkdirSync, renameSync, realpathSync } from "node:fs";
import { dirname, basename, join, relative, sep } from "node:path";
import { canonicalRoot, safeResolve, FsError } from "./fs-exec.ts";

/**
 * Write UTF-8 `text` to `relPath` under the repo `root`, creating parent
 * directories as needed. Root-scoped: a `..`-escape is rejected by
 * {@link safeResolve} before any disk touch. IN-PLACE (follows an in-project
 * symlink, preserves the target inode) — the editor-save path.
 */
export function writeTextWrite(root: string, relPath: string, text: string): void {
  const abs = safeResolve(root, relPath);
  // Ensure the parent dir exists (a new file in a not-yet-created sub-tree).
  // `safeResolve` already proved `abs` is inside the root, so its parent is too.
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text, "utf8");
}

let grantTmpSeq = 0;

/**
 * Hardlink-safe grant write (scoped-grant v2.2 step 6). A write performed under a
 * scoped grant (agent bulk writes) goes write-to-temp-in-dir + atomic `rename`,
 * which REPLACES the target inode — unlike {@link writeTextWrite}'s in-place write
 * kept for human editor saves (inode-preserving). Two properties this gains:
 *
 *  - **Hardlink neutralisation:** a target that is a hardlink to an out-of-tree
 *    victim (`src/x` hardlinked to `/etc/hosts`) is replaced, so the victim inode
 *    is unlinked from this name, never mutated in place. `realpath` does not
 *    resolve hardlinks, so {@link safeResolve} alone cannot catch this.
 *  - **Parent-symlink-swap close:** the destination dir is re-`realpath`'d and
 *    re-boundary-checked immediately before the rename, rejecting a directory
 *    symlink swapped into the parent chain after {@link safeResolve} ran.
 */
export function writeTextGrantWrite(root: string, relPath: string, text: string): void {
  const abs = safeResolve(root, relPath); // #32 boundary + out-of-root symlink guard
  const dir = dirname(abs);
  mkdirSync(dir, { recursive: true });
  // Re-canonicalise the now-existing destination dir and re-check the boundary.
  const base = canonicalRoot(root);
  const realDir = realpathSync(dir);
  const rel = relative(base, realDir);
  if (rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new FsError(`grant write escapes project root via directory symlink: ${relPath}`);
  }
  // Fresh temp inode in the same dir, then atomic rename over the target. `wx`
  // never clobbers a colliding temp; the rename replaces (not mutates) the target.
  const tmp = join(realDir, `.capisco-grant-${process.pid}-${++grantTmpSeq}.tmp`);
  writeFileSync(tmp, text, { encoding: "utf8", flag: "wx" });
  renameSync(tmp, join(realDir, basename(abs)));
}

/** Canonical root re-export so callers resolve the same symlink-followed root. */
export { canonicalRoot };
