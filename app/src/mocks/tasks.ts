import type {
  Burndown,
  DonutSegment,
  Epic,
  Sprint,
  Ticket,
  TicketColumn,
  WipRow,
} from "@/contracts";

/**
 * Deterministic Tasks-Workspace provider (build-spec §6, prototype shared.jsx
 * TICKETS / SPRINT / BURNDOWN / …). Implements the R0 data-shape interfaces;
 * no Date.now / Math.random. Chart inputs reference chart-palette var names.
 */

const SPRINT: Sprint = { name: "Sprint 24", day: 6, days: 10, committed: 52, done: 19 };

const TICKETS: Ticket[] = [
  { id: "CAP-142", title: "Worktree teardown frees its allocated port", type: "feature", points: 3, status: "progress", who: "you", mine: true, epic: "broker", branch: "#1284", sub: "2/3" },
  { id: "CAP-151", title: "Port allocator avoids TOCTOU race", type: "bug", points: 2, status: "progress", who: "you", mine: true, epic: "broker", branch: "#1276" },
  { id: "CAP-139", title: "Capability scope cache", type: "feature", points: 3, status: "review", who: "you", mine: true, epic: "broker", branch: "#1283" },
  { id: "CAP-160", title: "Session-tree token aggregation", type: "feature", points: 5, status: "testing", who: "you", mine: true, epic: "sessions", sub: "4/4" },
  { id: "CAP-148", title: "Broker: immutable grants once issued", type: "feature", points: 5, status: "todo", who: "mara", epic: "broker" },
  { id: "CAP-153", title: "Session resume from store", type: "feature", points: 8, status: "todo", who: "kai", epic: "sessions" },
  { id: "CAP-155", title: "Provider registry hot-reload", type: "feature", points: 5, status: "todo", who: "you", mine: true, epic: "sessions" },
  { id: "CAP-149", title: "Datasource: prod read-only guard", type: "feature", points: 3, status: "review", who: "lea", epic: "sessions", branch: "#1271" },
  { id: "CAP-150", title: "Flaky test: broker escalation", type: "bug", points: 1, status: "testing", who: "jdev", epic: "broker" },
  { id: "CAP-131", title: "Terminal: renameable tabs", type: "feature", points: 2, status: "done", who: "you", mine: true, epic: "shell" },
  { id: "CAP-128", title: "Activity bar drag-and-dock", type: "feature", points: 3, status: "done", who: "mara", epic: "shell" },
  { id: "CAP-126", title: "Diff view: split / unified", type: "feature", points: 5, status: "done", who: "you", mine: true, epic: "shell" },
  { id: "CAP-162", title: "Worktree GC on crash", type: "chore", points: 3, status: "backlog", who: "—", epic: "broker" },
  { id: "CAP-164", title: "Telemetry opt-in screen", type: "feature", points: 5, status: "backlog", who: "—", epic: "shell" },
];

const EPICS: Epic[] = [
  { id: "broker", label: "Worktree & Capability Broker" },
  { id: "sessions", label: "Sessions & Providers" },
  { id: "shell", label: "IDE Shell" },
];

const COLUMNS: TicketColumn[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To do" },
  { id: "progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "testing", label: "Testing" },
  { id: "done", label: "Done" },
];

const BURNDOWN: Burndown = {
  ideal: [52, 46.8, 41.6, 36.4, 31.2, 26, 20.8, 15.6, 10.4, 5.2, 0],
  team: [52, 50, 47, 44, 41, 36, 33, null, null, null, null],
  myIdeal: [18, 16.2, 14.4, 12.6, 10.8, 9, 7.2, 5.4, 3.6, 1.8, 0],
  mine: [18, 18, 15, 13, 11, 8, 6, null, null, null, null],
};

const TEAM_WIP: WipRow[] = [
  { who: "you", wip: 2, limit: 3 },
  { who: "mara", wip: 1, limit: 3 },
  { who: "kai", wip: 1, limit: 3 },
  { who: "jdev", wip: 1, limit: 2 },
  { who: "lea", wip: 1, limit: 3 },
];

const MY_WIP_SERIES = [1, 2, 2, 3, 2, 2, 2];
const REVIEWS_GIVEN = [1, 0, 2, 1, 3, 1, 2];
const THROUGHPUT = [0, 1, 1, 2, 1, 3, 2];
const SPRINT_DAY_LABELS = ["d0", "d1", "d2", "d3", "d4", "d5", "d6"];

const TYPE_SPLIT: DonutSegment[] = [
  { label: "Feature", value: 9, chartVar: "--chart-1" },
  { label: "Bug", value: 3, chartVar: "--chart-bad" },
  { label: "Chore", value: 2, chartVar: "--chart-6" },
];

/** Deterministic per-ticket detail (description + activity thread). */
const TICKET_DETAILS: Record<string, { description: string; comments: { who: string; when: string; text: string }[] }> = {
  "CAP-142": {
    description:
      "When a session ends, the worktree must be torn down and its allocated port released back to the broker pool. Currently the port leaks on crash.\n\nAcceptance:\n• teardown() releases the port\n• temp worktree dir is removed\n• covered by a test",
    comments: [
      { who: "mara", when: "2d ago", text: "Make sure release() is idempotent — dispose() can run twice on crash recovery." },
      { who: "you", when: "1d ago", text: "Good catch. Added a guard + a test for double-dispose." },
    ],
  },
};

const DEFAULT_DETAIL = {
  description: "No description yet. Edit to add acceptance criteria and context.",
  comments: [] as { who: string; when: string; text: string }[],
};

/** Chart-palette var per ticket type. */
const TYPE_CHART_VARS: Record<string, string> = {
  feature: "--chart-1",
  bug: "--chart-bad",
  chore: "--chart-6",
};

export const mockTasksProvider = {
  /** WIP limit per person (Insights). */
  wipLimit: 3,

  getSprint(): Sprint {
    return SPRINT;
  },
  getTickets(): Ticket[] {
    return TICKETS;
  },
  getTicket(id: string): Ticket | undefined {
    return TICKETS.find((t) => t.id === id);
  },
  getEpics(): Epic[] {
    return EPICS;
  },
  getColumns(): TicketColumn[] {
    return COLUMNS;
  },
  getMyTickets(): Ticket[] {
    return TICKETS.filter((t) => t.mine);
  },
  /** My tickets that are actively in flight (progress / review / testing). */
  getActiveTickets(): Ticket[] {
    return TICKETS.filter((t) => t.mine && ["progress", "review", "testing"].includes(t.status));
  },
  getBurndown(): Burndown {
    return BURNDOWN;
  },
  getTeamWip(): WipRow[] {
    return TEAM_WIP;
  },
  getMyWipSeries(): number[] {
    return MY_WIP_SERIES;
  },
  getReviewsGiven(): number[] {
    return REVIEWS_GIVEN;
  },
  getThroughput(): number[] {
    return THROUGHPUT;
  },
  getSprintDayLabels(): string[] {
    return SPRINT_DAY_LABELS;
  },
  getTypeSplit(): DonutSegment[] {
    return TYPE_SPLIT;
  },
  getTicketDetail(id: string) {
    return TICKET_DETAILS[id] ?? DEFAULT_DETAIL;
  },
  epicLabel(epicId: string | undefined): string {
    return EPICS.find((e) => e.id === epicId)?.label ?? "—";
  },
  typeChartVar(type: string): string {
    return TYPE_CHART_VARS[type] ?? "--chart-6";
  },
};

/** Back-compat export consumed by the left-panel TaskPanel (R6). */
export const mockTickets: Ticket[] = TICKETS;
