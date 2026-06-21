/**
 * {@link FixtureTaskProvider} (B6, §4.5) — maps `Ticket`s out of a recorded
 * task-system fixture (Jira/Linear), deterministically. The shipped read-only
 * provider; a live Jira/Linear adapter is a thin swap behind the same interface
 * (fixtures → API client + token injected at the execution layer).
 *
 * Pure by construction: it takes a {@link TaskFixture} *object*, not a file path
 * — so it is browser-safe and unit-testable with no I/O. The node-side loader
 * (`load-fixtures.ts`) reads the JSON and hands it in. No Date.now / Math.random
 * — ordering is by the fixture's own fields with a stable id tiebreak.
 */

import type { TaskFixture, TaskProvider, TaskBackend } from "@/contracts";
import type { Ticket, TicketStatus } from "@/contracts";

/**
 * "Pullability" rank for `nextFromSprint` (§4.5 "pull the next ticket from the
 * sprint"). Lower = pulled first. Only unstarted work is pullable: `todo`
 * before `backlog`; in-flight/closed statuses are not pullable.
 */
const PULL_RANK: Partial<Record<TicketStatus, number>> = {
  todo: 0,
  backlog: 1,
};

export class FixtureTaskProvider implements TaskProvider {
  readonly backend: TaskBackend;
  readonly me: string;
  private readonly tickets: readonly Ticket[];

  constructor(fixture: TaskFixture) {
    this.backend = fixture.backend;
    this.me = fixture.me;
    // Defensive copy — the provider never mutates the recorded fixture.
    this.tickets = fixture.tickets.map((t) => ({ ...t }));
  }

  listTickets(): Promise<Ticket[]> {
    return Promise.resolve(this.tickets.map((t) => ({ ...t })));
  }

  getTicket(id: string): Promise<Ticket | undefined> {
    const found = this.tickets.find((t) => t.id === id);
    return Promise.resolve(found ? { ...found } : undefined);
  }

  myTickets(): Promise<Ticket[]> {
    // "My tickets" = assigned to me. The fixture's `mine` flag mirrors
    // who === me; we resolve against the identity, not the flag, so a real
    // adapter that omits `mine` still works.
    return Promise.resolve(this.tickets.filter((t) => t.who === this.me).map((t) => ({ ...t })));
  }

  nextFromSprint(): Promise<Ticket | undefined> {
    const pullable = this.tickets
      .filter((t) => PULL_RANK[t.status] !== undefined)
      .slice()
      .sort((a, b) => {
        const ra = PULL_RANK[a.status] ?? Number.MAX_SAFE_INTEGER;
        const rb = PULL_RANK[b.status] ?? Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb; // todo before backlog
        if (a.points !== b.points) return a.points - b.points; // fewer points first
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; // stable id tiebreak
      });
    const next = pullable[0];
    return Promise.resolve(next ? { ...next } : undefined);
  }
}
