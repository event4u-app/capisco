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

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { canonicalRoot, safeResolve } from "./fs-exec.ts";

/**
 * Write UTF-8 `text` to `relPath` under the repo `root`, creating parent
 * directories as needed. Root-scoped: a `..`-escape is rejected by
 * {@link safeResolve} before any disk touch.
 */
export function writeTextWrite(root: string, relPath: string, text: string): void {
  const abs = safeResolve(root, relPath);
  // Ensure the parent dir exists (a new file in a not-yet-created sub-tree).
  // `safeResolve` already proved `abs` is inside the root, so its parent is too.
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text, "utf8");
}

/** Canonical root re-export so callers resolve the same symlink-followed root. */
export { canonicalRoot };
