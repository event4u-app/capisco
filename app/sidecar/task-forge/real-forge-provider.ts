/**
 * Real GitHub ForgeProvider (road-to-real-breadth P0) — the live swap for
 * FixtureForgeProvider, behind the identical {@link ForgeProvider} contract.
 * Reads PRs via the read-only `gh` primitive under the user's existing gh login
 * (no token entry). Verifiable against a real repo.
 *
 * Maps `gh pr list --json …` rows onto the UI `PullRequest` shape; `whoseTurn`
 * and `stale` mirror the fixture's semantics (§4.6): the "ball is mine" filter =
 * (I'm a requested reviewer) ∪ (my PR has requested changes), oldest-first.
 */

import type {
  ForgeBackend,
  ForgeProvider,
  PrChecks,
  PullRequest,
  ReviewState,
  WhoseTurnEntry,
} from "@/contracts";
import { ghMe, ghPrList, ghRepo } from "./gh-exec.ts";

const PR_FIELDS = [
  "number", "title", "headRefName", "author", "isDraft", "createdAt", "additions",
  "deletions", "labels", "reviewRequests", "reviews", "statusCheckRollup", "comments",
];

interface GhPr {
  number: number;
  title: string;
  headRefName: string;
  author: { login: string };
  isDraft: boolean;
  createdAt: string;
  additions: number;
  deletions: number;
  labels: { name: string }[];
  reviewRequests: { login?: string; name?: string }[];
  reviews: { author?: { login: string }; state: string }[];
  statusCheckRollup: { status?: string; conclusion?: string; state?: string }[];
  comments: unknown[];
}

function daysSince(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

export function checksOf(rollup: GhPr["statusCheckRollup"] | undefined): PrChecks {
  if (!rollup || rollup.length === 0) return "passing";
  let pending = false;
  for (const c of rollup) {
    const concl = (c.conclusion ?? "").toUpperCase();
    const status = (c.status ?? c.state ?? "").toUpperCase();
    if (concl === "FAILURE" || concl === "ERROR" || concl === "CANCELLED" || concl === "TIMED_OUT" || status === "FAILURE") {
      return "failing";
    }
    if (status && status !== "COMPLETED" && status !== "SUCCESS") pending = true;
  }
  return pending ? "pending" : "passing";
}

export function reviewStateOf(s: string): ReviewState {
  const up = `${s}`.toUpperCase();
  if (up === "APPROVED") return "approved";
  if (up === "CHANGES_REQUESTED") return "changes";
  return "pending";
}

export interface RealForgeProviderOptions {
  repo: string; // owner/name
  me: string;
  staleThresholdDays?: number;
}

export class RealForgeProvider implements ForgeProvider {
  readonly backend: ForgeBackend = "github";
  readonly me: string;
  readonly staleThresholdDays: number;
  readonly #repo: string;

  constructor(opts: RealForgeProviderOptions) {
    this.#repo = opts.repo;
    this.me = opts.me;
    this.staleThresholdDays = opts.staleThresholdDays ?? 7;
  }

  #toPr(row: GhPr): PullRequest {
    const reviews = (row.reviews ?? []).map((r) => ({
      who: r.author?.login ?? "?",
      state: reviewStateOf(r.state),
    }));
    return {
      num: row.number,
      title: row.title,
      repo: this.#repo,
      branch: row.headRefName,
      author: row.author?.login ?? "?",
      draft: Boolean(row.isDraft),
      days: daysSince(row.createdAt),
      checks: checksOf(row.statusCheckRollup),
      comments: Array.isArray(row.comments) ? row.comments.length : 0,
      add: row.additions ?? 0,
      del: row.deletions ?? 0,
      labels: (row.labels ?? []).map((l) => l.name),
      reviews,
      requested: (row.reviewRequests ?? []).some((r) => (r.login ?? r.name) === this.me),
      reviewedByMe: reviews.some((r) => r.who === this.me),
    };
  }

  async listPullRequests(): Promise<PullRequest[]> {
    const rows = (await ghPrList(this.#repo, PR_FIELDS)) as GhPr[];
    return rows.map((r) => this.#toPr(r));
  }

  async myPullRequests(): Promise<PullRequest[]> {
    return (await this.listPullRequests()).filter((p) => p.author === this.me);
  }

  async whoseTurn(): Promise<WhoseTurnEntry[]> {
    return selectWhoseTurn(await this.listPullRequests(), this.me);
  }

  async stale(threshold: number = this.staleThresholdDays): Promise<PullRequest[]> {
    return selectStale(await this.listPullRequests(), threshold);
  }
}

/** Pure: "ball is mine" = (I'm a requested reviewer) ∪ (my PR has requested changes). Oldest-first. */
export function selectWhoseTurn(prs: PullRequest[], me: string): WhoseTurnEntry[] {
  const entries: WhoseTurnEntry[] = [];
  for (const p of prs) {
    if (p.requested === true) entries.push({ pr: p, reason: "review-requested" });
    else if (p.author === me && p.reviews.some((r) => r.state === "changes")) {
      entries.push({ pr: p, reason: "changes-requested" });
    }
  }
  return entries.sort((a, b) => b.pr.days - a.pr.days || a.pr.num - b.pr.num);
}

/** Pure: PRs open longer than `threshold` days, oldest-first. */
export function selectStale(prs: PullRequest[], threshold: number): PullRequest[] {
  return prs.filter((p) => p.days > threshold).sort((a, b) => b.days - a.days || a.num - b.num);
}

/** Build a RealForgeProvider, resolving `me` + `repo` via gh when not given. */
export async function createRealForgeProvider(opts: {
  repo?: string;
  cwd?: string;
  staleThresholdDays?: number;
}): Promise<RealForgeProvider> {
  const repo = opts.repo ?? (await ghRepo(opts.cwd));
  if (!repo) throw new Error("no GitHub repo resolved — pass { repo } or run inside a gh-tracked checkout");
  const me = await ghMe();
  return new RealForgeProvider({ repo, me, staleThresholdDays: opts.staleThresholdDays });
}
