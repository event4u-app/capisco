/**
 * `.git/info/exclude` execution primitive (road-to-local-artifact-hygiene
 * Phase 1/2).
 *
 * WHY `.git/info/exclude` and not `.gitignore`: the project's `.gitignore`
 * belongs to the team — writing into it would land Capisco's lines in the shared
 * repo, collide with what developers maintain there, and force editing a file we
 * don't own. `.git/info/exclude` is Git's per-repo, LOCAL, never-committed,
 * never-shared ignore list — exactly "ignore this here without the team caring".
 * Reference: `agents/tmp/feature-gitignore.txt`.
 *
 * Security posture (mirrors `git/git-exec.ts`, `fs/fs-exec.ts`,
 * `fs/fs-write-exec.ts`): this is the single, audited place the `.git/info/
 * exclude` read+write lives. Its SOLE caller is the broker-gated adapter
 * (`git-exclude-broker.ts`), which runs the WRITE only inside `broker.execute` —
 * the un-bypassable chokepoint (B4). A denied capability never reaches the write
 * (`ensureExcludeBlockWrite`), so a denied attempt produces no disk change.
 * Listed in `broker-chokepoint.test.ts` as the audited home for these reads +
 * writes.
 *
 * Hard acceptance criteria encoded here:
 *  - **AK-G3 idempotent, marked block, no `.gitignore` touch** — only a single
 *    marked block (`# capisco — local, do not commit` … end marker) is written,
 *    exclusively to `.git/info/exclude`; a second run with the block already
 *    present + complete is a no-op (returns `wrote:false`).
 *  - **AK-G4 no-repo safe** — no `.git` dir → do nothing, no throw, never create
 *    `.git/`. {@link readExcludeState} reports `hasRepo:false`.
 *  - **`core.excludesFile` respected** — the user's machine-wide global ignore
 *    (`git config core.excludesFile`) is detected and reported so the caller can
 *    surface "already covered globally" instead of assuming Capisco is the only
 *    voice (feature-gitignore.txt §respektiere core.excludesFile).
 *  - **Path canonicalisation** — repo root is symlink-resolved (macOS `/var`→
 *    `/private/var`, B2 lesson) so the exclude path is stable.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { canonicalRoot } from "../fs/fs-exec.ts";

/** The block markers — recognisable + later removable (AK-G3). */
export const EXCLUDE_BLOCK_START = "# capisco — local, do not commit";
export const EXCLUDE_BLOCK_END = "# capisco — end";

export interface ExcludeState {
  /** False when the repo has no `.git` directory (AK-G4 — caller does nothing). */
  hasRepo: boolean;
  /** Absolute, symlink-resolved path to `.git/info/exclude` (when `hasRepo`). */
  excludePath?: string;
  /** Whether a complete Capisco block (start+end+all paths) is already present. */
  blockPresent: boolean;
  /**
   * The user's `core.excludesFile` if configured (machine-wide global ignore),
   * else undefined. Reported, never written — we only read this for transparency.
   */
  globalExcludesFile?: string;
}

/**
 * Locate the `.git` directory for `root`. Supports a normal repo (`.git/` dir)
 * AND a worktree / submodule where `.git` is a FILE containing `gitdir: <path>`
 * (the real common dir, where `info/exclude` lives). Returns the absolute git
 * dir, or undefined when there is no repo (AK-G4 — never creates one).
 */
export function resolveGitDir(root: string): string | undefined {
  const base = canonicalRoot(root);
  const dotGit = join(base, ".git");
  if (!existsSync(dotGit)) return undefined;
  try {
    // A linked worktree's `.git` is a FILE: `gitdir: /abs/.git/worktrees/x`.
    const stat = readFileSync(dotGit, "utf8");
    const m = /^gitdir:\s*(.+)\s*$/m.exec(stat);
    if (m) {
      // For a linked worktree, `info/exclude` lives in the MAIN repo's common
      // dir, not the per-worktree gitdir. Walk up `worktrees/<name>` → commondir.
      const wtGitDir = m[1].trim();
      const commonDirFile = join(wtGitDir, "commondir");
      if (existsSync(commonDirFile)) {
        const rel = readFileSync(commonDirFile, "utf8").trim();
        return canonicalRoot(join(wtGitDir, rel));
      }
      return wtGitDir;
    }
  } catch {
    // `.git` is a directory (readFileSync on a dir throws EISDIR) — the normal case.
  }
  return dotGit;
}

/**
 * Read the current exclude state for `root` WITHOUT writing anything. Reports
 * no-repo (AK-G4), whether a complete Capisco block already exists (idempotency
 * pre-check), and (when supplied) the user's `core.excludesFile`.
 *
 * `globalExcludesFile` is passed IN, not read here: the only place a `git config`
 * lookup may run is the system-git process primitive (`git-exec.ts`), which the
 * broker-gated adapter calls and threads through. Keeping the spawn out of this
 * fs primitive preserves the single-process-site chokepoint invariant.
 */
export function readExcludeState(
  root: string,
  requiredPaths: readonly string[],
  globalExcludesFile?: string,
): ExcludeState {
  const gitDir = resolveGitDir(root);
  if (!gitDir) return { hasRepo: false, blockPresent: false };

  const excludePath = canonicalExcludePath(gitDir);
  const existing = existsSync(excludePath) ? readFileSync(excludePath, "utf8") : "";
  const blockPresent = hasCompleteBlock(existing, requiredPaths);

  return {
    hasRepo: true,
    excludePath,
    blockPresent,
    globalExcludesFile: globalExcludesFile || undefined,
  };
}

/**
 * Idempotently ensure the Capisco marked block (covering `requiredPaths`) is
 * present in `.git/info/exclude`. THE WRITE — only ever called inside
 * `broker.execute` by the broker-gated adapter.
 *
 *  - No repo → no-op, `wrote:false`, no throw, `.git/` never created (AK-G4).
 *  - Complete block already present → no-op, `wrote:false` (AK-G3 idempotent).
 *  - Block missing/partial → rewrite ONLY the Capisco block (replacing any stale
 *    one), preserving every non-Capisco line verbatim. Touches `.git/info/
 *    exclude` exclusively — never `.gitignore` (AK-G3).
 */
export function ensureExcludeBlockWrite(
  root: string,
  requiredPaths: readonly string[],
): { hasRepo: boolean; wrote: boolean; excludePath?: string } {
  const gitDir = resolveGitDir(root);
  if (!gitDir) return { hasRepo: false, wrote: false };

  const excludePath = canonicalExcludePath(gitDir);
  const existing = existsSync(excludePath) ? readFileSync(excludePath, "utf8") : "";

  if (hasCompleteBlock(existing, requiredPaths)) {
    return { hasRepo: true, wrote: false, excludePath };
  }

  const next = upsertBlock(existing, requiredPaths);
  // `.git/info/` already exists in any real repo, but a freshly `git init`-ed
  // repo has it too; create defensively (recursive is a no-op if present). This
  // writes UNDER an existing `.git/` — it never creates `.git/` itself (guarded
  // by `resolveGitDir` returning undefined for no-repo above).
  mkdirSync(join(gitDir, "info"), { recursive: true });
  writeFileSync(excludePath, next, "utf8");
  return { hasRepo: true, wrote: true, excludePath };
}

/** Absolute, symlink-resolved path to the exclude file under a git dir. */
function canonicalExcludePath(gitDir: string): string {
  return join(gitDir, "info", "exclude");
}

/** The exact block text Capisco writes (start marker, paths, end marker). */
export function renderBlock(requiredPaths: readonly string[]): string {
  return [EXCLUDE_BLOCK_START, ...requiredPaths, EXCLUDE_BLOCK_END].join("\n");
}

/**
 * Whether `content` already contains a Capisco block that covers EVERY required
 * path (the idempotency test). A block missing a path is treated as incomplete
 * so a later Capisco version adding an artifact path upgrades it on next run.
 */
function hasCompleteBlock(content: string, requiredPaths: readonly string[]): boolean {
  const block = extractBlock(content);
  if (block === undefined) return false;
  const lines = new Set(block.split("\n").map((l) => l.trim()));
  return requiredPaths.every((p) => lines.has(p));
}

/** Return the lines BETWEEN the markers (exclusive), or undefined if no block. */
function extractBlock(content: string): string | undefined {
  const lines = content.split("\n");
  const start = lines.indexOf(EXCLUDE_BLOCK_START);
  if (start === -1) return undefined;
  const end = lines.indexOf(EXCLUDE_BLOCK_END, start + 1);
  if (end === -1) return undefined;
  return lines.slice(start + 1, end).join("\n");
}

/**
 * Replace an existing Capisco block (if any) with a fresh complete one, else
 * append it. Every non-Capisco line is preserved verbatim. A single trailing
 * newline is normalised so re-runs are byte-stable.
 */
function upsertBlock(existing: string, requiredPaths: readonly string[]): string {
  const block = renderBlock(requiredPaths);
  const lines = existing.length > 0 ? existing.split("\n") : [];
  const start = lines.indexOf(EXCLUDE_BLOCK_START);

  if (start !== -1) {
    const end = lines.indexOf(EXCLUDE_BLOCK_END, start + 1);
    if (end !== -1) {
      // Replace the stale block in place.
      const before = lines.slice(0, start);
      const after = lines.slice(end + 1);
      return joinNonEmptyBlocks([before.join("\n"), block, after.join("\n")]);
    }
    // A start marker with no end (corrupt) — drop from the start marker on and
    // re-append a clean block.
    return joinNonEmptyBlocks([lines.slice(0, start).join("\n"), block]);
  }

  // No block yet — append after the existing content (preserving the user's lines).
  return joinNonEmptyBlocks([existing.replace(/\n+$/, ""), block]);
}

/** Join non-empty segments with a single blank line; end with one newline. */
function joinNonEmptyBlocks(parts: string[]): string {
  const kept = parts.map((p) => p.replace(/^\n+|\n+$/g, "")).filter((p) => p.length > 0);
  return kept.join("\n\n") + "\n";
}
