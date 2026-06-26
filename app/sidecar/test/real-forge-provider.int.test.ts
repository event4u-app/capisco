/**
 * RealForgeProvider tests (road-to-real-breadth P0).
 *  - PURE unit tests for the mapping/selection logic (deterministic, no network).
 *  - INTEGRATION smoke against the REAL repo via `gh` (skips if gh unauth'd).
 */

import { describe, expect, it } from "vitest";

import type { PullRequest } from "@/contracts";
import { ghAvailable } from "../task-forge/gh-exec.ts";
import {
  checksOf,
  createRealForgeProvider,
  reviewStateOf,
  selectStale,
  selectWhoseTurn,
} from "../task-forge/real-forge-provider.ts";

const ghReady = await ghAvailable();
const run = ghReady ? it : it.skip;

function pr(over: Partial<PullRequest>): PullRequest {
  return {
    num: 1, title: "t", repo: "o/r", branch: "b", author: "alice", draft: false, days: 1,
    checks: "passing", comments: 0, add: 0, del: 0, labels: [], reviews: [], ...over,
  };
}

describe("checksOf", () => {
  it("empty rollup → passing", () => expect(checksOf([])).toBe("passing"));
  it("a failure → failing", () => expect(checksOf([{ conclusion: "FAILURE" }])).toBe("failing"));
  it("in-progress → pending", () => expect(checksOf([{ status: "IN_PROGRESS" }])).toBe("pending"));
  it("all success → passing", () => expect(checksOf([{ status: "COMPLETED", conclusion: "SUCCESS" }])).toBe("passing"));
});

describe("reviewStateOf", () => {
  it("maps gh review states", () => {
    expect(reviewStateOf("APPROVED")).toBe("approved");
    expect(reviewStateOf("CHANGES_REQUESTED")).toBe("changes");
    expect(reviewStateOf("COMMENTED")).toBe("pending");
  });
});

describe("selectWhoseTurn", () => {
  it("unions requested-reviews + changes-on-my-PR, oldest-first", () => {
    const prs = [
      pr({ num: 1, author: "bob", requested: true, days: 2 }), // I'm requested reviewer
      pr({ num: 2, author: "me", reviews: [{ who: "bob", state: "changes" }], days: 5 }), // changes on mine
      pr({ num: 3, author: "bob", days: 9 }), // neither → excluded
      pr({ num: 4, author: "me", reviews: [{ who: "x", state: "approved" }], days: 1 }), // mine, approved → excluded
    ];
    const turn = selectWhoseTurn(prs, "me");
    expect(turn.map((e) => [e.pr.num, e.reason])).toEqual([
      [2, "changes-requested"], // days 5 (oldest of the two)
      [1, "review-requested"], // days 2
    ]);
  });
});

describe("selectStale", () => {
  it("keeps PRs older than threshold, oldest-first", () => {
    const prs = [pr({ num: 1, days: 3 }), pr({ num: 2, days: 10 }), pr({ num: 3, days: 8 })];
    expect(selectStale(prs, 7).map((p) => p.num)).toEqual([2, 3]);
  });
});

describe("RealForgeProvider ↔ real gh (integration)", () => {
  run(
    "resolves me + lists real PRs in the expected shape",
    async () => {
      const forge = await createRealForgeProvider({ repo: "event4u-app/capisco" });
      expect(forge.me.length).toBeGreaterThan(0);
      const prs = await forge.listPullRequests();
      expect(Array.isArray(prs)).toBe(true);
      for (const p of prs) {
        expect(typeof p.num).toBe("number");
        expect(typeof p.author).toBe("string");
        expect(["passing", "failing", "pending"]).toContain(p.checks);
        expect(p.days).toBeGreaterThanOrEqual(0);
        expect(p.repo).toBe("event4u-app/capisco");
      }
      // whoseTurn/stale run without throwing against the real data.
      expect(Array.isArray(await forge.whoseTurn())).toBe(true);
      expect(Array.isArray(await forge.stale(0))).toBe(true);
    },
    30_000,
  );
});
