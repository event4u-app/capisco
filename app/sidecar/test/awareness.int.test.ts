/**
 * Forge-Awareness tests (road-to-real-breadth P0).
 *  - PURE unit tests for the overlap / conflict-prediction + relWhen logic.
 *  - INTEGRATION smoke: forge-driven awareness against the REAL repo via `gh`
 *    (skips if gh is unauth'd), asserting the AwarenessEntry shape.
 */

import { describe, expect, it } from "vitest";

import type { PullRequest } from "@/contracts";
import { ghAvailable, ghPrFiles } from "../task-forge/gh-exec.ts";
import { computeAwareness, forgeAwareness, relWhen } from "../task-forge/awareness.ts";
import { createRealForgeProvider } from "../task-forge/real-forge-provider.ts";

const ghReady = await ghAvailable();
const run = ghReady ? it : it.skip;

function pr(over: Partial<PullRequest>): PullRequest {
  return {
    num: 1, title: "t", repo: "o/r", branch: "b", author: "alice", draft: false, days: 1,
    checks: "passing", comments: 0, add: 0, del: 0, labels: [], reviews: [], ...over,
  };
}

describe("relWhen", () => {
  it("buckets days into compact labels", () => {
    expect(relWhen(0)).toBe("today");
    expect(relWhen(1)).toBe("1d ago");
    expect(relWhen(3)).toBe("3d ago");
    expect(relWhen(14)).toBe("2w ago");
    expect(relWhen(60)).toBe("2mo ago");
  });
});

describe("computeAwareness — branch overlap / conflict prediction", () => {
  it("annotates the files two open PRs share (both sides)", () => {
    const entries = computeAwareness([
      { pr: pr({ num: 10, author: "alice", branch: "feat/a" }), files: ["broker.ts", "registry.ts"] },
      { pr: pr({ num: 11, author: "bob", branch: "feat/b" }), files: ["registry.ts", "ipc.ts"] },
    ]);
    const a = entries.find((e) => e.pr === "#10");
    const b = entries.find((e) => e.pr === "#11");
    expect(a?.overlap).toBe("registry.ts");
    expect(b?.overlap).toBe("registry.ts");
    expect(a?.who).toBe("alice");
    expect(b?.branch).toBe("feat/b");
  });

  it("a PR with no shared files has no overlap field", () => {
    const [only] = computeAwareness([{ pr: pr({ num: 5 }), files: ["solo.ts"] }]);
    expect(only.overlap).toBeUndefined();
    expect(only.files).toEqual(["solo.ts"]);
  });

  it("draft → act 'draft'; stale day-count → status idle", () => {
    const [d] = computeAwareness([{ pr: pr({ num: 7, draft: true, days: 30, title: "WIP" }), files: [] }], 7);
    expect(d.act).toBe("draft");
    expect(d.status).toBe("idle");
    expect(d.when).toBe("1mo ago");
  });

  it("non-draft within threshold → act=title, status active, multi-file overlap sorted+joined", () => {
    const entries = computeAwareness([
      { pr: pr({ num: 1, title: "Add cache", days: 2 }), files: ["z.ts", "a.ts"] },
      { pr: pr({ num: 2, days: 2 }), files: ["a.ts", "z.ts", "m.ts"] },
    ]);
    const first = entries.find((e) => e.pr === "#1");
    expect(first?.act).toBe("Add cache");
    expect(first?.status).toBe("active");
    expect(first?.files).toEqual(["a.ts", "z.ts"]); // sorted
    expect(first?.overlap).toBe("a.ts, z.ts"); // sorted + joined
  });
});

describe("forgeAwareness ↔ real gh (integration)", () => {
  run(
    "builds AwarenessEntry rows from the real repo's open PRs",
    async () => {
      const repo = "event4u-app/capisco";
      const forge = await createRealForgeProvider({ repo });
      const entries = await forgeAwareness(forge, (num) => ghPrFiles(repo, num));
      expect(Array.isArray(entries)).toBe(true);
      for (const e of entries) {
        expect(typeof e.who).toBe("string");
        expect(e.pr).toMatch(/^#\d+$/);
        expect(Array.isArray(e.files)).toBe(true);
        expect(["active", "idle"]).toContain(e.status);
      }
    },
    60_000,
  );
});
