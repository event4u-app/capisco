/**
 * RealLinearTaskProvider tests (road-to-real-breadth P0, second task backend).
 *  - PURE unit tests for the Linear status/ticket mapping (deterministic).
 *  - INTEGRATION smoke against real Linear when LINEAR_LIVE=1 + a `linear-token`
 *    is in the keychain (else skipped).
 */

import { describe, expect, it } from "vitest";

import {
  createRealLinearProvider,
  mapLinearStatus,
  toLinearTicket,
} from "../task-forge/real-linear-provider.ts";
import { createSecretStore } from "../broker/create-secret-store.ts";

describe("mapLinearStatus", () => {
  it("maps Linear state.type + name to TicketStatus", () => {
    expect(mapLinearStatus("backlog", "Backlog")).toBe("backlog");
    expect(mapLinearStatus("triage", "Triage")).toBe("backlog");
    expect(mapLinearStatus("unstarted", "Todo")).toBe("todo");
    expect(mapLinearStatus("started", "In Progress")).toBe("progress");
    expect(mapLinearStatus("started", "In Review")).toBe("review"); // name beats type
    expect(mapLinearStatus("started", "QA")).toBe("testing");
    expect(mapLinearStatus("completed", "Done")).toBe("done");
    expect(mapLinearStatus("canceled", "Canceled")).toBe("done");
  });
});

describe("toLinearTicket", () => {
  it("maps a Linear issue node to a Ticket, marks mine via user id", () => {
    expect(
      toLinearTicket(
        {
          identifier: "ENG-42",
          title: "Wire the thing",
          estimate: 3,
          assignee: { id: "u1", name: "Matze" },
          state: { name: "In Progress", type: "started" },
        },
        "u1",
      ),
    ).toEqual({
      id: "ENG-42",
      title: "Wire the thing",
      type: "feature",
      points: 3,
      status: "progress",
      who: "Matze",
      mine: true,
    });
  });
  it("unassigned + no estimate → safe defaults, mine=false", () => {
    const t = toLinearTicket(
      { identifier: "ENG-7", title: "x", estimate: null, assignee: null, state: { name: "Todo", type: "unstarted" } },
      "u1",
    );
    expect(t.who).toBe("Unassigned");
    expect(t.points).toBe(0);
    expect(t.mine).toBe(false);
    expect(t.status).toBe("todo");
  });
});

describe("RealLinearTaskProvider ↔ real Linear (integration)", () => {
  const run = process.env.LINEAR_LIVE === "1" ? it : it.skip;
  run(
    "resolves me + lists my tickets in the Ticket shape",
    async () => {
      const secrets = await createSecretStore();
      const linear = await createRealLinearProvider({ secrets });
      expect(linear.me.length).toBeGreaterThan(0);
      const mine = await linear.myTickets();
      expect(Array.isArray(mine)).toBe(true);
      for (const t of mine) {
        expect(["feature", "bug", "chore"]).toContain(t.type);
        expect(["backlog", "todo", "progress", "review", "testing", "done"]).toContain(t.status);
      }
    },
    30_000,
  );
});
