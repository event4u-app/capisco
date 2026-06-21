/**
 * First-party filesystem READ primitive (road-to-runnable-dev P1).
 *
 * Security posture (mirrors `git/git-exec.ts`): this is the single, allowlisted
 * place `node:fs` read calls live for project-tree + file-content reads. The
 * capability broker (B4) mediates *which* reads an agent may perform; this
 * helper is the first-party execution primitive it gates — it is NOT an
 * open-ended fs escape. The architecture/lint test (`broker-chokepoint.test.ts`)
 * fails if `node:fs` reads/writes appear in any sidecar file outside the
 * allowlisted execution primitives.
 *
 * Path-traversal guard: every read is resolved against the repo root and
 * rejected if it escapes it — a relative path can never reach outside the
 * opened project.
 */

import { readFileSync, readdirSync, statSync, realpathSync, existsSync } from "node:fs";
import { resolve, relative, sep } from "node:path";

export class FsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FsError";
  }
}

/** Canonical absolute root, following symlinks (macOS `/var`→`/private/var`). */
export function canonicalRoot(root: string): string {
  try {
    return realpathSync(root);
  } catch {
    return resolve(root);
  }
}

/**
 * Resolve `relPath` against `root`, rejecting any path that escapes the root
 * (`..` traversal, absolute paths pointing elsewhere). Returns the absolute path.
 */
export function safeResolve(root: string, relPath: string): string {
  const base = canonicalRoot(root);
  const abs = resolve(base, relPath);
  const rel = relative(base, abs);
  if (rel === "" || rel.startsWith("..") || rel.startsWith(`..${sep}`)) {
    throw new FsError(`path escapes project root: ${relPath}`);
  }
  return abs;
}

export interface DirEntry {
  name: string;
  isDir: boolean;
}

/** List a directory's entries (names + dir flag). Root-scoped. */
export function listDir(root: string, relDir: string): DirEntry[] {
  const abs = relDir === "" ? canonicalRoot(root) : safeResolve(root, relDir);
  const dirents = readdirSync(abs, { withFileTypes: true });
  return dirents.map((d) => ({
    name: d.name,
    // Follow symlinked dirs so a symlinked sub-tree still expands.
    isDir: d.isDirectory() || (d.isSymbolicLink() && safeIsDir(resolve(abs, d.name))),
  }));
}

function safeIsDir(abs: string): boolean {
  try {
    return statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

/** Read a UTF-8 file, root-scoped. */
export function readText(root: string, relPath: string): string {
  const abs = safeResolve(root, relPath);
  return readFileSync(abs, "utf8");
}

/** Whether the repo root exists as a directory. */
export function rootExists(root: string): boolean {
  const abs = canonicalRoot(root);
  return existsSync(abs) && safeIsDir(abs);
}
