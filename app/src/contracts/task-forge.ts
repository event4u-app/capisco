/**
 * Task- & Forge-provider contracts (B6, road-to-task-forge, concept §4.5/§4.6).
 *
 * A ticket system (Jira/Linear) and a code forge (GitHub/GitLab) are treated
 * like language packs: ONE interface, several backends. Concept §4.5: the
 * dashboard answers "my tickets" and "pull the next ticket from the sprint";
 * §4.6: the forge answers "whose turn is it?" — the PRs where I block the team
 * (I am a requested reviewer) plus my own PRs with requested changes.
 *
 * SCOPE (Council Lens C): bidirectional sync is 2–3× under-scaled (webhooks,
 * conflicts, divergent status semantics). This contract is **read-only** —
 * pulling tickets/PRs in. The single write-back direction (ticket→status) is
 * NOT on this provider; it lives in the lifecycle orchestrator behind the
 * broker (`contracts/lifecycle.ts`), so an external write is always a mediated,
 * human-gated capability — never a silent provider method.
 *
 * DEFERRED: live API tokens (Jira/Linear/GitHub), webhooks, full bidirectional
 * sync. The shipped impls are {@link FixtureTaskProvider} /
 * {@link FixtureForgeProvider} — they map `Ticket` / `PullRequest` out of
 * recorded JSON fixtures, deterministically (no Date.now / Math.random). A real
 * adapter is a thin swap behind the same interface: same shapes on the wire, the
 * fixtures replaced by a live API client + a token injected at the execution
 * layer (never into the LLM context / session store / logs — §3.2).
 */

import type { PullRequest, Ticket } from "./workspace.ts";

/** Which ticket backend a fixture was recorded from (provenance, not behaviour). */
export type TaskBackend = "jira" | "linear";

/** Which forge backend a fixture was recorded from. */
export type ForgeBackend = "github" | "gitlab";

/**
 * A recorded ticket-system fixture — the JSON shape on disk. `sprint` is the
 * active sprint identifier the "next from sprint" pull reasons over; `me` is the
 * identity that resolves "my tickets" (the recorded viewer). The real adapter
 * derives `me` from the authenticated token; the fixture pins it.
 */
export interface TaskFixture {
  backend: TaskBackend;
  /** The recorded viewer identity ("my tickets" = tickets where who === me). */
  me: string;
  /** Active sprint name (used by `nextFromSprint`). */
  sprint: string;
  /** Recorded tickets. */
  tickets: Ticket[];
}

/**
 * A recorded forge fixture. `me` is the recorded viewer (resolves "whose turn":
 * PRs where I am a requested reviewer, and my PRs with requested changes).
 */
export interface ForgeFixture {
  backend: ForgeBackend;
  /** The recorded viewer identity. */
  me: string;
  /** Stale-PR threshold in days (concept §4.6, default 7). */
  staleThresholdDays: number;
  /** Recorded pull requests. */
  pulls: PullRequest[];
}

/**
 * Read-only ticket provider (§4.5). Jira and Linear are implementations; the
 * shipped one reads recorded JSON. Every method is async (the real adapter is
 * network I/O; the fixture resolves immediately, deterministically).
 */
export interface TaskProvider {
  /** Which backend this provider was recorded from / talks to. */
  readonly backend: TaskBackend;
  /** The viewer identity "my tickets" resolves against. */
  readonly me: string;
  /** Every ticket in the recorded set. */
  listTickets(): Promise<Ticket[]>;
  /** One ticket by id, or undefined. */
  getTicket(id: string): Promise<Ticket | undefined>;
  /** "My tickets" (§4.5) — tickets assigned to {@link me}. */
  myTickets(): Promise<Ticket[]>;
  /**
   * "Pull the next ticket from the sprint" (§4.5). The next actionable ticket in
   * the active sprint: the highest-priority unstarted ticket (status `todo`,
   * then `backlog`), preferring fewer points, deterministic id-tiebreak.
   * Resolves undefined when the sprint has nothing pullable.
   */
  nextFromSprint(): Promise<Ticket | undefined>;
}

/** One row of the "whose turn is it?" filter (§4.6) — a PR + why it's my turn. */
export interface WhoseTurnEntry {
  pr: PullRequest;
  /**
   * Why this PR awaits me:
   *  - `review-requested` — I am a requested reviewer (I block the team).
   *  - `changes-requested` — my PR has requested changes (the ball is mine).
   */
  reason: "review-requested" | "changes-requested";
}

/**
 * Read-only forge provider (§4.6). GitHub and GitLab are implementations; the
 * shipped one reads recorded JSON. Async like {@link TaskProvider}.
 */
export interface ForgeProvider {
  readonly backend: ForgeBackend;
  readonly me: string;
  /** Stale-PR threshold in days (§4.6, default 7). */
  readonly staleThresholdDays: number;
  /** Every recorded pull request. */
  listPullRequests(): Promise<PullRequest[]>;
  /** My open pull requests (author === {@link me}). */
  myPullRequests(): Promise<PullRequest[]>;
  /**
   * The central "whose turn is it?" filter (§4.6): PRs where I am a requested
   * reviewer (I block the team) UNIONED with my PRs that have requested changes.
   * Ordered by PR age (oldest first), id-tiebreak.
   */
  whoseTurn(): Promise<WhoseTurnEntry[]>;
  /**
   * Stale PRs — open longer than `threshold` days (§4.6, default
   * {@link staleThresholdDays}). Ordered oldest-first.
   */
  stale(threshold?: number): Promise<PullRequest[]>;
}
