/**
 * Real Linear TaskProvider (road-to-real-breadth P0, second task backend) —
 * behind the identical {@link TaskProvider} contract, via the read-only Linear
 * GraphQL client. Auth via ProviderAuth (rawToken = personal API key, or Bearer
 * = OAuth) per the Provider-Auth directive.
 *
 * Pure mapping (`mapLinearStatus`, `toLinearTicket`) is exported for tests;
 * `pickNextFromSprint` is shared with the Jira provider (same sprint semantics).
 */

import type { SecretStore, TaskBackend, Ticket, TicketStatus } from "@/contracts";
import type { TaskProvider } from "@/contracts";
import { rawTokenAuth, type ProviderAuth } from "../auth/provider-auth.ts";
import { linearQuery } from "./linear-http.ts";
import { pickNextFromSprint } from "./real-task-provider.ts";

const ISSUE_FIELDS = `identifier title estimate assignee { id name } state { name type }`;

interface LinearIssueNode {
  identifier: string;
  title: string;
  estimate: number | null;
  assignee: { id: string; name: string } | null;
  state: { name: string; type: string };
}

/** Linear state.type (+ name) → TicketStatus. */
export function mapLinearStatus(type: string | undefined, name: string | undefined): TicketStatus {
  const n = `${name ?? ""}`.toLowerCase();
  if (n.includes("review")) return "review";
  if (n.includes("test") || n.includes("qa")) return "testing";
  switch (`${type ?? ""}`) {
    case "backlog":
    case "triage":
      return "backlog";
    case "unstarted":
      return "todo";
    case "started":
      return "progress";
    case "completed":
    case "canceled":
      return "done";
    default:
      return "todo";
  }
}

export function toLinearTicket(node: LinearIssueNode, myId: string): Ticket {
  return {
    id: node.identifier,
    title: node.title,
    type: "feature", // Linear has no built-in issue type; default (label-based inference is a follow-on)
    points: typeof node.estimate === "number" ? node.estimate : 0,
    status: mapLinearStatus(node.state?.type, node.state?.name),
    who: node.assignee?.name ?? "Unassigned",
    mine: node.assignee?.id !== undefined && node.assignee.id === myId,
  };
}

export interface RealLinearProviderOptions {
  auth: ProviderAuth;
  me: string; // Linear user id
}

export class RealLinearTaskProvider implements TaskProvider {
  readonly backend: TaskBackend = "linear";
  readonly me: string;
  readonly #auth: ProviderAuth;

  constructor(opts: RealLinearProviderOptions) {
    this.me = opts.me;
    this.#auth = opts.auth;
  }

  async #issues(filter: string): Promise<Ticket[]> {
    const data = await linearQuery<{ issues: { nodes: LinearIssueNode[] } }>(
      this.#auth,
      `query($f: IssueFilter) { issues(first: 50, filter: $f) { nodes { ${ISSUE_FIELDS} } } }`,
      { f: JSON.parse(filter) as unknown },
    );
    return (data.issues?.nodes ?? []).map((n) => toLinearTicket(n, this.me));
  }

  listTickets(): Promise<Ticket[]> {
    return this.#issues(JSON.stringify({ assignee: { isMe: { eq: true } } }));
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const m = /^([A-Za-z0-9]+)-(\d+)$/.exec(id.trim());
    if (!m) return undefined;
    const tickets = await this.#issues(
      JSON.stringify({ team: { key: { eq: m[1] } }, number: { eq: Number(m[2]) } }),
    );
    return tickets[0];
  }

  myTickets(): Promise<Ticket[]> {
    return this.#issues(
      JSON.stringify({ assignee: { isMe: { eq: true } }, state: { type: { neq: "completed" } } }),
    );
  }

  async nextFromSprint(): Promise<Ticket | undefined> {
    const inCycle = await this.#issues(
      JSON.stringify({
        cycle: { isActive: { eq: true } },
        assignee: { isMe: { eq: true } },
        state: { type: { neq: "completed" } },
      }),
    ).catch(() => [] as Ticket[]);
    return pickNextFromSprint(inCycle);
  }
}

/** Build a Linear TaskProvider (rawToken personal-key mode), resolving `me` via viewer. */
export async function createRealLinearProvider(opts: {
  secrets: SecretStore;
  tokenRef?: string;
}): Promise<RealLinearTaskProvider> {
  const auth = rawTokenAuth(opts.secrets, opts.tokenRef ?? "linear-token");
  const data = await linearQuery<{ viewer: { id: string } }>(auth, `query { viewer { id name } }`);
  return new RealLinearTaskProvider({ auth, me: data.viewer.id });
}
