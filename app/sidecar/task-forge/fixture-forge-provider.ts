/**
 * {@link FixtureForgeProvider} (B6, §4.6) — maps `PullRequest`s out of a
 * recorded forge fixture (GitHub/GitLab), deterministically. The central filter
 * is "whose turn is it?" (§4.6): PRs where I am a requested reviewer (I block
 * the team) UNIONED with my PRs that have requested changes (the ball is mine).
 *
 * Pure by construction (takes a {@link ForgeFixture} object, not a path) — so it
 * is browser-safe and unit-testable. No Date.now / Math.random — staleness is
 * read off the fixture's own `days` field; ordering is age then id tiebreak.
 */

import type { ForgeFixture, ForgeProvider, ForgeBackend, WhoseTurnEntry } from "@/contracts";
import type { PullRequest } from "@/contracts";

export class FixtureForgeProvider implements ForgeProvider {
  readonly backend: ForgeBackend;
  readonly me: string;
  readonly staleThresholdDays: number;
  private readonly pulls: readonly PullRequest[];

  constructor(fixture: ForgeFixture) {
    this.backend = fixture.backend;
    this.me = fixture.me;
    this.staleThresholdDays = fixture.staleThresholdDays;
    this.pulls = fixture.pulls.map((p) => ({ ...p }));
  }

  private clone(p: PullRequest): PullRequest {
    return { ...p, labels: [...p.labels], reviews: p.reviews.map((r) => ({ ...r })) };
  }

  listPullRequests(): Promise<PullRequest[]> {
    return Promise.resolve(this.pulls.map((p) => this.clone(p)));
  }

  myPullRequests(): Promise<PullRequest[]> {
    return Promise.resolve(this.pulls.filter((p) => p.author === this.me).map((p) => this.clone(p)));
  }

  /** Am I a requested reviewer on this PR (I block the team)? */
  private blocksTeam(p: PullRequest): boolean {
    if (p.author === this.me) return false; // can't review my own PR
    // Explicit reviewer-request flag, or a pending review assigned to me.
    if (p.requested) return true;
    return p.reviews.some((r) => r.who === this.me && r.state === "pending");
  }

  /** Does my own PR have requested changes (the ball is back with me)? */
  private changesOnMine(p: PullRequest): boolean {
    if (p.author !== this.me) return false;
    return p.reviews.some((r) => r.state === "changes");
  }

  whoseTurn(): Promise<WhoseTurnEntry[]> {
    const entries: WhoseTurnEntry[] = [];
    for (const p of this.pulls) {
      if (this.blocksTeam(p)) {
        entries.push({ pr: this.clone(p), reason: "review-requested" });
      } else if (this.changesOnMine(p)) {
        entries.push({ pr: this.clone(p), reason: "changes-requested" });
      }
    }
    // Oldest-first (most urgent), stable num tiebreak.
    entries.sort((a, b) => b.pr.days - a.pr.days || a.pr.num - b.pr.num);
    return Promise.resolve(entries);
  }

  stale(threshold: number = this.staleThresholdDays): Promise<PullRequest[]> {
    const stale = this.pulls
      .filter((p) => !p.draft && p.days > threshold)
      .map((p) => this.clone(p))
      .sort((a, b) => b.days - a.days || a.num - b.num);
    return Promise.resolve(stale);
  }
}
