/**
 * B6 Phase 0 — FixtureTaskProvider + FixtureForgeProvider against recorded JSON.
 * Verifies the §4.5/§4.6 surface: "my tickets", "next from sprint", "whose turn"
 * — for both task backends (Jira/Linear) and both forge backends (GitHub/GitLab).
 * Deterministic; no Date.now / Math.random.
 */

import { describe, expect, it } from "vitest";
import { FixtureTaskProvider } from "../task-forge/fixture-task-provider.ts";
import { FixtureForgeProvider } from "../task-forge/fixture-forge-provider.ts";
import {
  createFixtureForgeProvider,
  createFixtureTaskProvider,
  loadForgeFixture,
  loadTaskFixture,
} from "../task-forge/load-fixtures.ts";

describe("FixtureTaskProvider (Jira/Linear from recorded JSON)", () => {
  it("loads the jira fixture and maps tickets", async () => {
    const task = createFixtureTaskProvider("jira");
    expect(task.backend).toBe("jira");
    expect(task.me).toBe("you");
    const tickets = await task.listTickets();
    expect(tickets.length).toBeGreaterThan(0);
    expect(tickets[0].id).toMatch(/^CAP-/);
  });

  it("getTicket resolves a known id and undefined for unknown", async () => {
    const task = createFixtureTaskProvider("jira");
    expect((await task.getTicket("CAP-142"))?.title).toContain("Worktree teardown");
    expect(await task.getTicket("CAP-999")).toBeUndefined();
  });

  it('"my tickets" = tickets assigned to the recorded viewer', async () => {
    const task = createFixtureTaskProvider("jira");
    const mine = await task.myTickets();
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((t) => t.who === "you")).toBe(true);
    // mara/kai tickets are excluded.
    expect(mine.some((t) => t.id === "CAP-148")).toBe(false);
  });

  it('"next from sprint" pulls the highest-priority unstarted ticket (todo > backlog, fewer points, id tiebreak)', async () => {
    const task = createFixtureTaskProvider("jira");
    const next = await task.nextFromSprint();
    // todo tickets in jira fixture: CAP-155(5), CAP-148(5), CAP-153(8), CAP-167(2).
    // fewest points among todo = CAP-167 (2). It wins over any backlog ticket.
    expect(next?.id).toBe("CAP-167");
    expect(next?.status).toBe("todo");
  });

  it("works for the Linear backend too (different identity + sprint)", async () => {
    const task = createFixtureTaskProvider("linear");
    expect(task.backend).toBe("linear");
    expect(task.me).toBe("mara");
    const mine = await task.myTickets();
    expect(mine.every((t) => t.who === "mara")).toBe(true);
    // linear todos: ENG-198(5), ENG-221(3); fewest points = ENG-221.
    expect((await task.nextFromSprint())?.id).toBe("ENG-221");
  });

  it("nextFromSprint resolves undefined when nothing is pullable", async () => {
    const task = new FixtureTaskProvider({
      backend: "jira",
      me: "you",
      sprint: "S",
      tickets: [
        { id: "X-1", title: "done", type: "chore", points: 1, status: "done", who: "you" },
        { id: "X-2", title: "wip", type: "chore", points: 1, status: "progress", who: "you" },
      ],
    });
    expect(await task.nextFromSprint()).toBeUndefined();
  });

  it("never mutates the recorded fixture (defensive copies)", async () => {
    const fixture = loadTaskFixture("jira");
    const task = new FixtureTaskProvider(fixture);
    const a = await task.listTickets();
    a[0].title = "MUTATED";
    const b = await task.listTickets();
    expect(b[0].title).not.toBe("MUTATED");
  });
});

describe("FixtureForgeProvider (GitHub/GitLab from recorded JSON)", () => {
  it("loads the github fixture and maps PRs", async () => {
    const forge = createFixtureForgeProvider("github");
    expect(forge.backend).toBe("github");
    expect(forge.staleThresholdDays).toBe(7);
    expect((await forge.listPullRequests()).length).toBeGreaterThan(0);
  });

  it('"my PRs" = PRs authored by the viewer', async () => {
    const forge = createFixtureForgeProvider("github");
    const mine = await forge.myPullRequests();
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((p) => p.author === "you")).toBe(true);
  });

  it('"whose turn" unions review-requested-on-me + changes-requested-on-mine', async () => {
    const forge = createFixtureForgeProvider("github");
    const turns = await forge.whoseTurn();
    const byNum = new Map(turns.map((t) => [t.pr.num, t.reason]));
    // PR 1290 + 1271: I (you) am a requested reviewer → review-requested.
    expect(byNum.get(1290)).toBe("review-requested");
    expect(byNum.get(1271)).toBe("review-requested");
    // PR 1284: my own PR with a "changes" review → changes-requested.
    expect(byNum.get(1284)).toBe("changes-requested");
    // PR 1283 (mine, approved) is NOT my turn; 1295 (someone else, no request) not mine.
    expect(byNum.has(1283)).toBe(false);
    expect(byNum.has(1295)).toBe(false);
  });

  it('"whose turn" never claims I review my own PR', async () => {
    const forge = createFixtureForgeProvider("github");
    const turns = await forge.whoseTurn();
    for (const t of turns) {
      if (t.reason === "review-requested") expect(t.pr.author).not.toBe(forge.me);
    }
  });

  it("stale = open PRs older than the threshold, oldest-first, drafts excluded", async () => {
    const forge = createFixtureForgeProvider("github");
    const stale = await forge.stale(); // default 7
    // > 7 days, non-draft: 1271(11), 1276(9). Oldest first.
    expect(stale.map((p) => p.num)).toEqual([1271, 1276]);
    // A custom threshold widens/narrows the set.
    expect((await forge.stale(0)).length).toBeGreaterThan(2);
  });

  it("works for the GitLab backend too (different identity)", async () => {
    const forge = createFixtureForgeProvider("gitlab");
    expect(forge.backend).toBe("gitlab");
    expect(forge.me).toBe("mara");
    const turns = await forge.whoseTurn();
    const byNum = new Map(turns.map((t) => [t.pr.num, t.reason]));
    // MR 84: mara is a requested reviewer. MR 88: mara's own MR with changes.
    expect(byNum.get(84)).toBe("review-requested");
    expect(byNum.get(88)).toBe("changes-requested");
  });

  it("never mutates the recorded fixture", async () => {
    const forge = new FixtureForgeProvider(loadForgeFixture("github"));
    const a = await forge.listPullRequests();
    a[0].title = "MUTATED";
    a[0].labels.push("x");
    const b = await forge.listPullRequests();
    expect(b[0].title).not.toBe("MUTATED");
    expect(b[0].labels).not.toContain("x");
  });
});
