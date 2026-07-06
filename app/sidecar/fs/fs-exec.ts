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
import { resolve, relative, sep, dirname, basename } from "node:path";

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
 * Canonicalise `abs` by `realpath`-ing its deepest EXISTING ancestor and
 * re-appending the not-yet-created tail. A fresh write's target file does not
 * exist yet, so we cannot `realpath` it directly — but any symlink in its
 * existing prefix (a symlinked parent, or the leaf itself when it already
 * exists) IS resolved to its real on-disk location. On macOS this also folds
 * case + Unicode normalisation into the comparison.
 */
function realCanonical(abs: string): string {
  let existing = abs;
  const tail: string[] = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) return abs; // reached the fs root; nothing to resolve
    tail.unshift(basename(existing));
    existing = parent;
  }
  try {
    const real = realpathSync(existing);
    return tail.length ? resolve(real, ...tail) : real;
  } catch {
    return abs;
  }
}

/**
 * Resolve `relPath` against `root`, rejecting any path that escapes the root
 * (`..` traversal, absolute paths pointing elsewhere, OR a symlink that points
 * outside the root). Returns the absolute path.
 *
 * Two-stage guard:
 *  1. String check — the resolved absolute path is lexically inside `base`.
 *  2. Symlink check — the CANONICAL path (realpath of the existing prefix, see
 *     {@link realCanonical}) is still inside `base`. This closes the escape where
 *     a symlink INSIDE the root points OUTSIDE it (e.g. `src/link → /etc`): the
 *     string check passes but the canonical path is outside, so it is rejected —
 *     while an IN-project symlinked sub-tree still canonicalises inside and is
 *     allowed (so `listDir`'s intentional symlink expansion keeps working).
 *     Residual: a symlink swapped in AFTER this check but BEFORE the write
 *     (TOCTOU) is not covered here — that needs an `openat`/`O_NOFOLLOW` write,
 *     which is deferred because it would also block legitimate edits of an
 *     in-project symlinked file.
 */
export function safeResolve(root: string, relPath: string): string {
  const base = canonicalRoot(root);
  const abs = resolve(base, relPath);
  const rel = relative(base, abs);
  if (rel === "" || rel.startsWith("..") || rel.startsWith(`..${sep}`)) {
    throw new FsError(`path escapes project root: ${relPath}`);
  }
  const canonical = realCanonical(abs);
  const canonicalRel = relative(base, canonical);
  if (canonicalRel === ".." || canonicalRel.startsWith(`..${sep}`)) {
    throw new FsError(`path escapes project root via symlink: ${relPath}`);
  }
  return abs;
}

/**
 * The absolute, realpath-canonicalised form of `relPath` under `root` — the
 * input a scoped grant's `pathPrefix` check compares against (scoped-grant v2.2
 * F1). It boundary-guards via {@link safeResolve} first (an escape throws), then
 * canonicalises so the value compared against the (also canonical) prefix is
 * symlink-resolved. The policy engine stays I/O-free by consuming THIS string.
 */
export function canonicalizeTarget(root: string, relPath: string): string {
  return realCanonical(safeResolve(root, relPath));
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
