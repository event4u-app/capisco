/**
 * Scoped-grant pattern-coverage preview (matrix P1, item 229) — pure, deterministic.
 *
 * Mirrors the sidecar broker's boundary rule (`policy-engine.isUnderPrefix`): a
 * target is covered when it IS the prefix or lies STRICTLY under it (`/src/`
 * never matches `/srcX`). This is the ADVISORY UI preview — the authoritative
 * check is the broker's `scopeMatches` at grant time; keeping the rule identical
 * means the preview never over-promises what the grant will actually clear.
 */

import type { GrantPreview, PendingWriteIntent } from "@/contracts";

/** Boundary-anchored containment (posix canonical paths, NFC-normalised). */
export function isUnderPrefix(target: string, prefix: string): boolean {
  if (!prefix) return false;
  const t = target.normalize("NFC");
  const base = prefix.normalize("NFC");
  const withSep = base.endsWith("/") ? base : base + "/";
  return t === base || t === base.replace(/\/$/, "") || t.startsWith(withSep);
}

/**
 * Suggest a scoped-grant prefix from a set of pending writes: the top-level
 * directory shared by the covered majority. We take the first path segment under
 * the deepest common ancestor — in practice the project sub-tree (e.g. `<repo>/src/`).
 * Falls back to the common directory of ALL pending writes. Returns `""` when the
 * set is empty (the caller then offers no scoped option).
 */
export function suggestPathPrefix(pending: PendingWriteIntent[]): string {
  if (pending.length === 0) return "";
  const segs = pending.map((p) => p.canonicalTarget.normalize("NFC").split("/"));
  // Longest common ancestor of the DIRECTORIES (drop each file's last segment).
  const dirs = segs.map((s) => s.slice(0, -1));
  let common = dirs[0]!;
  for (const d of dirs.slice(1)) {
    let i = 0;
    while (i < common.length && i < d.length && common[i] === d[i]) i++;
    common = common.slice(0, i);
  }
  if (common.length === 0) return "";
  // Extend the common ancestor by ONE segment (the shared project sub-tree, e.g.
  // `src`) when every write agrees on it — a tighter, more meaningful prefix.
  const nextSeg = dirs[0]![common.length];
  if (nextSeg !== undefined && dirs.every((d) => d[common.length] === nextSeg)) {
    common = [...common, nextSeg];
  }
  return common.join("/") + "/";
}

/**
 * Partition `pending` by a candidate `pathPrefix` into covered / out-of-scope,
 * with a suggested `maxActions` budget (the covered count, at least 1). Pure —
 * the same input always yields the same preview.
 */
export function buildGrantPreview(
  pending: PendingWriteIntent[],
  pathPrefix: string,
): GrantPreview {
  const covered: PendingWriteIntent[] = [];
  const outOfScope: PendingWriteIntent[] = [];
  for (const w of pending) {
    if (isUnderPrefix(w.canonicalTarget, pathPrefix)) covered.push(w);
    else outOfScope.push(w);
  }
  return { pathPrefix, covered, outOfScope, maxActions: Math.max(1, covered.length) };
}
