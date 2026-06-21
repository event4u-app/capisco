/**
 * ToDo provider (B3 Phase 2 — the micro-north-star, concept §4.11). Composes the
 * markdown ToDo parser with the broker-gated ACP session + the session store:
 *
 *   clickable `- [ ]`  →  sendToAgent  →  broker-gated stub session in the
 *   current worktree  →  status open → in-progress → done.
 *
 * It invents no new primitive (concept §9 — convergence over sprawl): the ToDo
 * is just a structured prompt that drives the existing Phase 1 spine. The agent
 * run is the deterministic stub; a real ACP CLI is the same swap (the provider
 * only knows the {@link TodoSessionStarter} seam).
 *
 * SECURITY: the provider never runs the agent's actions itself — it delegates to
 * the {@link AcpSession}, whose only action path is the broker. The ToDo text is
 * UNTRUSTED once it round-trips through the agent (a ToDo file could be authored
 * by anyone / pasted from the web), so the egress the agent derives from it hits
 * the lethal-trifecta hard gate.
 */

import type {
  SessionStore,
  TodoItem,
  TodoProvider,
  TodoStatus,
  TodoView,
} from "@/contracts";
import { parseTodos } from "@/lib/todo/todo-parser.ts";

/**
 * Starts a session for a ToDo prompt in a worktree and resolves the store
 * session id once the run COMPLETES. Production wiring passes an
 * {@link AcpSession}-backed starter; tests pass a deterministic fake. The
 * starter owns the broker gate.
 */
export type TodoSessionStarter = (
  prompt: string,
  worktreePath: string,
) => Promise<string>;

export class TodoProviderImpl implements TodoProvider {
  readonly #store: SessionStore;
  readonly #start: TodoSessionStarter;
  /** todoId → status (open until sent, then driven by its session). */
  readonly #status = new Map<string, TodoStatus>();
  /** todoId → triggered session id. */
  readonly #sessions = new Map<string, string>();

  constructor(store: SessionStore, start: TodoSessionStarter) {
    this.#store = store;
    this.#start = start;
  }

  async list(filePath: string, markdown: string): Promise<TodoView[]> {
    const items = parseTodos(filePath, markdown);
    return items.map((item) => ({
      ...item,
      status: this.#status.get(item.id) ?? (item.checked ? "done" : "open"),
      sessionId: this.#sessions.get(item.id),
    }));
  }

  async sendToAgent(item: TodoItem, worktreePath: string): Promise<string> {
    // Flip to in-progress immediately (UI feedback), before the run completes.
    this.#status.set(item.id, "in-progress");
    let sessionId: string;
    try {
      sessionId = await this.#start(item.text, worktreePath);
    } catch (err) {
      // A failed/blocked run reverts the ToDo to open — never silently "done".
      this.#status.set(item.id, "open");
      throw err;
    }
    this.#sessions.set(item.id, sessionId);
    // Drive the ToDo status from the session's final status (§4.5-lite).
    const stored = await this.#store.get(sessionId);
    this.#status.set(item.id, stored?.status === "done" ? "done" : "in-progress");
    return sessionId;
  }

  async statusOf(todoId: string): Promise<TodoStatus> {
    return this.#status.get(todoId) ?? "open";
  }
}

/** Factory mirroring the other deterministic-fake constructors. */
export function createTodoProvider(
  store: SessionStore,
  start: TodoSessionStarter,
): TodoProvider {
  return new TodoProviderImpl(store, start);
}
