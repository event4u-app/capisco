/**
 * Forge-driven Awareness (road-to-real-breadth P0): who-works-where +
 * branch-overlap + file-level conflict-prediction across the OPEN pull requests.
 *
 * Read-only: it reads each open PR (ForgeProvider) and the PR's changed-file
 * set (`gh pr view --json files` via gh-exec) — no egress beyond the existing
 * allowlisted `gh` primitive, no writes. The overlap pass is a pure function.
 *
 * SCOPE: this is the forge-derivable half of `AwarenessEntry` — branch overlap
 * and conflict prediction. Live presence ("who is editing X right now") is NOT
 * forge-derivable (it needs LSP/presence signals) and is a follow-on phase; the
 * `act` field here carries the PR title (or "draft"), the honest forge signal.
 */

import type { AwarenessEntry, ForgeProvider, PullRequest } from "@/contracts";

/** Days-ago → compact relative label ("today" / "2d ago" / "3w ago" / "2mo ago"). */
export function relWhen(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export interface PrWithFiles {
  pr: PullRequest;
  files: string[];
}

/**
 * Compute cross-PR awareness. For each open PR, `overlap` names the file(s) it
 * shares with at least one OTHER open PR — the branches that will collide on
 * merge (file-level conflict prediction). `status` is `active` when the PR is
 * within the stale threshold, else `idle`. Pure — no I/O.
 */
export function computeAwareness(
  prs: readonly PrWithFiles[],
  staleThresholdDays = 7,
): AwarenessEntry[] {
  return prs.map(({ pr, files }) => {
    const own = new Set(files);
    const shared = new Set<string>();
    for (const other of prs) {
      if (other.pr.num === pr.num) continue;
      for (const f of other.files) if (own.has(f)) shared.add(f);
    }
    const overlap = [...shared].sort();
    return {
      who: pr.author,
      branch: pr.branch,
      pr: `#${pr.num}`,
      act: pr.draft ? "draft" : pr.title,
      when: relWhen(pr.days),
      files: [...own].sort(),
      status: pr.days <= staleThresholdDays ? "active" : "idle",
      ...(overlap.length > 0 ? { overlap: overlap.join(", ") } : {}),
    };
  });
}

/**
 * Build forge-driven awareness: the open PRs + each PR's changed-file set,
 * fed through {@link computeAwareness}. `fetchFiles` is the per-PR file reader
 * (`ghPrFiles` in real use); a PR whose file read fails contributes an empty
 * set rather than failing the whole board.
 */
export async function forgeAwareness(
  forge: ForgeProvider,
  fetchFiles: (num: number) => Promise<string[]>,
): Promise<AwarenessEntry[]> {
  const prs = await forge.listPullRequests();
  const withFiles = await Promise.all(
    prs.map(async (pr) => ({ pr, files: await fetchFiles(pr.num).catch(() => [] as string[]) })),
  );
  return computeAwareness(withFiles, forge.staleThresholdDays);
}
