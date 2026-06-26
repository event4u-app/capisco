/**
 * RealTaskProvider (Jira) tests (road-to-real-breadth P0).
 *  - PURE unit tests for mapping + sprint-pick (deterministic, no network).
 *  - INTEGRATION smoke against REAL Jira when JIRA_BASE_URL + JIRA_EMAIL env are
 *    set and a `jira-token` is in the keychain (else skipped).
 */

import { describe, expect, it } from "vitest";

import type { JiraIssue } from "../task-forge/jira-http.ts";
import {
  createRealTaskProvider,
  mapStatus,
  mapType,
  pickNextFromSprint,
  toTicket,
} from "../task-forge/real-task-provider.ts";
import { createSecretStore } from "../broker/create-secret-store.ts";
import type { Ticket } from "@/contracts";

describe("mapType", () => {
  it("maps Jira issue types to TicketType", () => {
    expect(mapType("Bug")).toBe("bug");
    expect(mapType("Sub-task")).toBe("chore");
    expect(mapType("Task")).toBe("chore");
    expect(mapType("Story")).toBe("feature");
    expect(mapType("Epic")).toBe("feature");
  });
});

describe("mapStatus", () => {
  it("maps by name then category", () => {
    expect(mapStatus("To Do", "new")).toBe("todo");
    expect(mapStatus("In Progress", "indeterminate")).toBe("progress");
    expect(mapStatus("In Review", "indeterminate")).toBe("review");
    expect(mapStatus("QA", "indeterminate")).toBe("testing");
    expect(mapStatus("Done", "done")).toBe("done");
    expect(mapStatus("Backlog", "new")).toBe("backlog");
    expect(mapStatus("Weird Custom", "indeterminate")).toBe("progress"); // category fallback
  });
});

describe("toTicket", () => {
  it("maps a Jira issue to a Ticket + marks mine via accountId", () => {
    const issue: JiraIssue = {
      key: "GAL-42",
      fields: {
        summary: "Fix the thing",
        issuetype: { name: "Bug" },
        status: { name: "In Progress", statusCategory: { key: "indeterminate" } },
        assignee: { displayName: "Matze", accountId: "acc-1" },
        customfield_10016: 3,
      },
    };
    expect(toTicket(issue, "acc-1", "customfield_10016")).toEqual({
      id: "GAL-42",
      title: "Fix the thing",
      type: "bug",
      points: 3,
      status: "progress",
      who: "Matze",
      mine: true,
    });
  });
  it("unassigned + missing points → safe defaults, mine=false", () => {
    const t = toTicket({ key: "GAL-7", fields: { summary: "x", issuetype: { name: "Story" }, status: { name: "To Do", statusCategory: { key: "new" } } } }, "acc-1", "customfield_10016");
    expect(t.who).toBe("Unassigned");
    expect(t.points).toBe(0);
    expect(t.mine).toBe(false);
  });
});

describe("pickNextFromSprint", () => {
  function t(over: Partial<Ticket>): Ticket {
    return { id: "A-1", title: "t", type: "feature", points: 1, status: "todo", who: "me", ...over };
  }
  it("prefers todo over backlog, then fewer points, then id", () => {
    const picked = pickNextFromSprint([
      t({ id: "A-3", status: "backlog", points: 1 }),
      t({ id: "A-1", status: "todo", points: 5 }),
      t({ id: "A-2", status: "todo", points: 2 }),
      t({ id: "A-9", status: "progress", points: 1 }), // started → excluded
    ]);
    expect(picked?.id).toBe("A-2"); // todo + fewest points
  });
  it("returns undefined when nothing is pullable", () => {
    expect(pickNextFromSprint([t({ status: "progress" }), t({ status: "done" })])).toBeUndefined();
  });
});

describe("RealTaskProvider ↔ real Jira (integration)", () => {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const run = baseUrl && email ? it : it.skip;

  run(
    "connects, resolves me, lists my tickets in the Ticket shape",
    async () => {
      const secrets = await createSecretStore();
      const provider = await createRealTaskProvider({ baseUrl: baseUrl as string, email: email as string, secrets });
      expect(provider.me.length).toBeGreaterThan(0); // /myself resolved → creds valid
      const mine = await provider.myTickets();
      expect(Array.isArray(mine)).toBe(true);
      for (const t of mine) {
        expect(typeof t.id).toBe("string");
        expect(["feature", "bug", "chore"]).toContain(t.type);
        expect(["backlog", "todo", "progress", "review", "testing", "done"]).toContain(t.status);
      }
      expect(Array.isArray(await provider.listTickets())).toBe(true);
    },
    30_000,
  );
});
