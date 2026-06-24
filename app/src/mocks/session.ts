/**
 * Deterministic browser mock {@link SessionStore} + {@link TodoProvider}
 * (road-to-runnable-dev P3). The browser/visual fallback for the persistent
 * session store + the ToDo→agent micro-north-star.
 *
 * The session store is a disk-free in-memory model (deterministic monotonic
 * `seq`, no Date.now / Math.random). The ToDo provider parses the markdown
 * (pure, browser-safe) and lists items, but `sendToAgent` — which requires the
 * broker chokepoint + a real ACP child process — is a DEV-RUNTIME-ONLY path: in
 * the browser there is no sidecar, so it rejects honestly rather than faking a
 * run. The real swap (`InMemorySessionStore` + `TodoProviderImpl` behind the
 * dev bridge) reaches a broker-gated stub session.
 */

import type {
  ResumedSession,
  SessionSearchHit,
  SessionStore,
  StoredSession,
  TodoProvider,
  TodoStatus,
  TodoView,
  TranscriptBlock,
  ModelId,
  SessionStatus,
  SessionTree,
  Telemetry,
} from "@/contracts";
import { parseTodos } from "@/lib/todo/todo-parser.ts";

const ZERO_TELEMETRY: Telemetry = { tokensIn: 0, tokensOut: 0, runtimeMs: 0 };

interface Rec {
  session: StoredSession;
  blocks: TranscriptBlock[];
  tree: SessionTree;
}

/**
 * Minimal in-memory session store — the browser fallback. Mirrors the sidecar
 * `InMemorySessionStore` surface deterministically; the disk/ACP-backed run is
 * the dev-bridge swap.
 */
class MockSessionStore implements SessionStore {
  readonly #sessions = new Map<string, Rec>();
  #seq = 0;

  #require(id: string): Rec {
    const rec = this.#sessions.get(id);
    if (!rec) throw new Error(`unknown session "${id}"`);
    return rec;
  }

  create(input: {
    id?: string;
    model: ModelId;
    title: string;
    status?: SessionStatus;
    worktreePath?: string;
  }): Promise<StoredSession> {
    const seq = ++this.#seq;
    const id = input.id ?? `sess-${seq}`;
    const session: StoredSession = {
      id,
      model: input.model,
      status: input.status ?? "idle",
      title: input.title,
      telemetry: { ...ZERO_TELEMETRY },
      worktreePath: input.worktreePath,
      seq,
    };
    this.#sessions.set(id, {
      session,
      blocks: [],
      tree: { nodes: {}, roots: [], activeLeaf: "" },
    });
    return Promise.resolve({ ...session });
  }

  list(): Promise<StoredSession[]> {
    return Promise.resolve(
      [...this.#sessions.values()].map((r) => ({ ...r.session })).sort((a, b) => a.seq - b.seq),
    );
  }

  get(id: string): Promise<StoredSession | null> {
    const rec = this.#sessions.get(id);
    return Promise.resolve(rec ? { ...rec.session } : null);
  }

  append(id: string, block: TranscriptBlock): Promise<string> {
    const rec = this.#require(id);
    rec.blocks.push(block);
    return Promise.resolve(block.block.id);
  }

  update(
    id: string,
    patch: Partial<Pick<StoredSession, "status" | "telemetry" | "title" | "worktreePath">>,
  ): Promise<void> {
    const rec = this.#require(id);
    Object.assign(rec.session, patch);
    return Promise.resolve();
  }

  resume(id: string): Promise<ResumedSession> {
    const rec = this.#require(id);
    return Promise.resolve({
      session: { ...rec.session },
      blocks: [...rec.blocks],
      tree: rec.tree,
    });
  }

  retryAsBranch(id: string): Promise<string> {
    this.#require(id);
    return Promise.resolve(`${id}-b${++this.#seq}`);
  }

  copy(id: string, newTitle?: string): Promise<StoredSession> {
    const rec = this.#require(id);
    const seq = ++this.#seq;
    const copy: StoredSession = {
      ...rec.session,
      id: `sess-${seq}`,
      title: newTitle ?? `${rec.session.title} (copy)`,
      copiedFrom: id,
      seq,
    };
    this.#sessions.set(copy.id, { session: copy, blocks: [...rec.blocks], tree: rec.tree });
    return Promise.resolve({ ...copy });
  }

  search(): Promise<SessionSearchHit[]> {
    return Promise.resolve([]);
  }
}

/** Browser ToDo provider: parse + list works; sendToAgent is dev-runtime only. */
class MockTodoProvider implements TodoProvider {
  list(filePath: string, markdown: string): Promise<TodoView[]> {
    return Promise.resolve(
      parseTodos(filePath, markdown).map((item) => ({
        ...item,
        status: (item.checked ? "done" : "open") as TodoStatus,
      })),
    );
  }

  sendToAgent(): Promise<string> {
    // No broker / ACP in the browser — the live run is the dev-bridge swap.
    return Promise.reject(new Error("sendToAgent requires the live sidecar (dev bridge)"));
  }

  statusOf(): Promise<TodoStatus> {
    return Promise.resolve("open");
  }
}

export const mockSessionStore: SessionStore = new MockSessionStore();
export const mockTodoProvider: TodoProvider = new MockTodoProvider();
