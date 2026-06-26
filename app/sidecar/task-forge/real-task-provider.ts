/**
 * Real Jira TaskProvider (road-to-real-breadth P0) — the live swap for
 * FixtureTaskProvider, behind the identical {@link TaskProvider} contract.
 * Reads via the GET-only Jira REST client using {@link ProviderAuth} (token mode
 * today; OAuth/MCP plug in behind the same auth — see the Provider-Auth directive).
 *
 * Pure mapping (Jira issue → Ticket) + `nextFromSprint` ranking are exported for
 * deterministic unit tests; the live path is integration-tested against real Jira.
 */

import type { SecretStore, TaskBackend, Ticket, TicketStatus, TicketType } from "@/contracts";
import type { TaskProvider } from "@/contracts";
import { basicTokenAuth, type ProviderAuth } from "../auth/provider-auth.ts";
import { jiraMyself, jiraSearch, type JiraIssue } from "./jira-http.ts";

/** Common Jira Cloud "Story point estimate" field; overridable per instance. */
const DEFAULT_POINTS_FIELD = "customfield_10016";

function fieldList(pointsField: string): string[] {
  return ["summary", "issuetype", "status", "assignee", "priority", pointsField];
}

export function mapType(issueTypeName: string | undefined): TicketType {
  const n = `${issueTypeName ?? ""}`.toLowerCase();
  if (n.includes("bug")) return "bug";
  if (n.includes("sub-task") || n.includes("subtask") || n.includes("task") || n.includes("chore")) return "chore";
  return "feature"; // story / epic / feature / improvement / …
}

export function mapStatus(statusName: string | undefined, categoryKey: string | undefined): TicketStatus {
  const n = `${statusName ?? ""}`.toLowerCase();
  if (n.includes("backlog")) return "backlog";
  if (n.includes("review")) return "review";
  if (n.includes("test") || n.includes("qa")) return "testing";
  if (n.includes("progress") || n.includes("doing")) return "progress";
  if (n === "to do" || n === "todo" || n === "selected for development" || n === "open") return "todo";
  if (n.includes("done") || n.includes("closed") || n.includes("resolved")) return "done";
  // Fall back to the status category.
  switch (`${categoryKey ?? ""}`) {
    case "done":
      return "done";
    case "indeterminate":
      return "progress";
    default:
      return "todo"; // "new"
  }
}

function toPoints(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function toTicket(issue: JiraIssue, myAccountId: string, pointsField: string): Ticket {
  const f = issue.fields;
  const issuetype = (f.issuetype as { name?: string } | undefined)?.name;
  const status = f.status as { name?: string; statusCategory?: { key?: string } } | undefined;
  const assignee = f.assignee as { displayName?: string; accountId?: string } | undefined;
  return {
    id: issue.key,
    title: `${(f.summary as string) ?? issue.key}`,
    type: mapType(issuetype),
    points: toPoints(f[pointsField]),
    status: mapStatus(status?.name, status?.statusCategory?.key),
    who: assignee?.displayName ?? "Unassigned",
    mine: assignee?.accountId !== undefined && assignee.accountId === myAccountId,
  };
}

/** Pure: pick the next pullable sprint ticket — unstarted (todo>backlog), fewer points, id-tiebreak. */
export function pickNextFromSprint(tickets: Ticket[]): Ticket | undefined {
  const rank: Record<string, number> = { todo: 0, backlog: 1 };
  const pullable = tickets.filter((t) => t.status === "todo" || t.status === "backlog");
  return pullable.sort(
    (a, b) => rank[a.status] - rank[b.status] || a.points - b.points || a.id.localeCompare(b.id),
  )[0];
}

export interface RealTaskProviderOptions {
  baseUrl: string;
  auth: ProviderAuth;
  me: string; // accountId
  pointsField?: string;
}

export class RealTaskProvider implements TaskProvider {
  readonly backend: TaskBackend = "jira";
  readonly me: string;
  readonly #baseUrl: string;
  readonly #auth: ProviderAuth;
  readonly #pointsField: string;

  constructor(opts: RealTaskProviderOptions) {
    this.#baseUrl = opts.baseUrl;
    this.#auth = opts.auth;
    this.me = opts.me;
    this.#pointsField = opts.pointsField ?? DEFAULT_POINTS_FIELD;
  }

  #map(issues: JiraIssue[]): Ticket[] {
    return issues.map((i) => toTicket(i, this.me, this.#pointsField));
  }

  async #search(jql: string): Promise<Ticket[]> {
    return this.#map(await jiraSearch(this.#baseUrl, this.#auth, jql, fieldList(this.#pointsField)));
  }

  async listTickets(): Promise<Ticket[]> {
    // My relevant set (assigned or reported), recently updated — bounded.
    return this.#search("assignee = currentUser() OR reporter = currentUser() ORDER BY updated DESC");
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const safe = id.replace(/[^A-Za-z0-9-]/g, "");
    return (await this.#search(`key = "${safe}"`))[0];
  }

  async myTickets(): Promise<Ticket[]> {
    return this.#search("assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC");
  }

  async nextFromSprint(): Promise<Ticket | undefined> {
    const inSprint = await this.#search(
      "sprint IN openSprints() AND assignee = currentUser() AND statusCategory != Done ORDER BY rank ASC",
    ).catch(() => [] as Ticket[]); // boards without sprints → JQL error → empty
    return pickNextFromSprint(inSprint);
  }
}

/** Build a Jira RealTaskProvider (token mode), resolving `me` via /myself. */
export async function createRealTaskProvider(opts: {
  baseUrl: string;
  email: string;
  secrets: SecretStore;
  tokenRef?: string;
  pointsField?: string;
}): Promise<RealTaskProvider> {
  const auth = basicTokenAuth(opts.secrets, opts.tokenRef ?? "jira-token", opts.email);
  const self = await jiraMyself(opts.baseUrl, auth);
  return new RealTaskProvider({ baseUrl: opts.baseUrl, auth, me: self.accountId, pointsField: opts.pointsField });
}
