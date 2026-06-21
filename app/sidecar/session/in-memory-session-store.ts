/**
 * In-memory SessionStore (B3 Phase 0) — the deterministic-fake persistent store
 * behind the {@link SessionStore} contract (concept §2.2). Resume / search /
 * retry-as-branch / copy all fall out of one clean data model:
 *
 *  - A `StoredSession` record per session (model / status / title / telemetry /
 *    worktree coupling / monotonic `seq`).
 *  - An ordered {@link TranscriptBlock} list per session (the append log).
 *  - A {@link SessionTree} per session (linear by default; `retryAsBranch`
 *    grafts a sibling, NEVER overwriting the parent — §2.2).
 *  - An inverted index `token → {sessionId, blockId, snippet}` for full-text
 *    search over message bodies + tool targets.
 *
 * DETERMINISTIC: no Date.now / Math.random. A module-private monotonic counter
 * orders records and mints branch/copy ids, so tests are reproducible.
 *
 * DEFERRED: the real disk-backed store (SQLite / content-addressed blobs) is a
 * thin swap behind this same contract; `append`/`resume`/`search` map onto row
 * inserts + an FTS index.
 */

import type {
  ResumedSession,
  SessionSearchHit,
  SessionStore,
  StoredSession,
} from "@/contracts";
import type {
  ModelId,
  SessionNode,
  SessionStatus,
  SessionTree,
  Telemetry,
  TranscriptBlock,
} from "@/contracts";

const ZERO_TELEMETRY: Telemetry = { tokensIn: 0, tokensOut: 0, runtimeMs: 0 };

/** The searchable text of a block — message body or tool target. */
function indexText(block: TranscriptBlock): string {
  switch (block.type) {
    case "message":
      return block.block.body;
    case "tool":
      return `${block.block.kind} ${block.block.target}`;
    case "permission":
      return `${block.block.command} ${block.block.label}`;
  }
}

interface SessionRecord {
  session: StoredSession;
  blocks: TranscriptBlock[];
  tree: SessionTree;
}

export class InMemorySessionStore implements SessionStore {
  readonly #sessions = new Map<string, SessionRecord>();
  /** Monotonic ordinal — orders records, mints deterministic ids. */
  #seq = 0;

  #nextSeq(): number {
    return ++this.#seq;
  }

  #require(sessionId: string): SessionRecord {
    const rec = this.#sessions.get(sessionId);
    if (!rec) throw new Error(`unknown session "${sessionId}"`);
    return rec;
  }

  create(input: {
    id?: string;
    model: ModelId;
    title: string;
    status?: SessionStatus;
    worktreePath?: string;
  }): Promise<StoredSession> {
    const seq = this.#nextSeq();
    const id = input.id ?? `sess-${seq}`;
    if (this.#sessions.has(id)) {
      throw new Error(`session "${id}" already exists`);
    }
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
    const all = [...this.#sessions.values()]
      .map((r) => ({ ...r.session }))
      .sort((a, b) => a.seq - b.seq);
    return Promise.resolve(all);
  }

  get(sessionId: string): Promise<StoredSession | null> {
    const rec = this.#sessions.get(sessionId);
    return Promise.resolve(rec ? { ...rec.session } : null);
  }

  async append(sessionId: string, block: TranscriptBlock): Promise<string> {
    const rec = this.#require(sessionId);
    const nodeId = block.block.id;
    // Extend the linear tree: the new block chains onto the current active leaf
    // and becomes the new leaf.
    const prev = rec.tree.activeLeaf || null;
    const node: SessionNode = { id: nodeId, parentId: prev, block, children: [] };
    rec.tree.nodes[nodeId] = node;
    if (prev && rec.tree.nodes[prev]) {
      rec.tree.nodes[prev].children.push(nodeId);
    } else {
      rec.tree.roots.push(nodeId);
    }
    rec.tree.activeLeaf = nodeId;
    rec.blocks.push(block);
    return nodeId;
  }

  async update(
    sessionId: string,
    patch: Partial<
      Pick<StoredSession, "status" | "telemetry" | "title" | "worktreePath">
    >,
  ): Promise<void> {
    const rec = this.#require(sessionId);
    if (patch.status !== undefined) rec.session.status = patch.status;
    if (patch.telemetry !== undefined) rec.session.telemetry = { ...patch.telemetry };
    if (patch.title !== undefined) rec.session.title = patch.title;
    if (patch.worktreePath !== undefined) rec.session.worktreePath = patch.worktreePath;
  }

  async resume(sessionId: string): Promise<ResumedSession> {
    const rec = this.#require(sessionId);
    return {
      session: { ...rec.session },
      blocks: [...rec.blocks],
      tree: cloneTree(rec.tree),
    };
  }

  async retryAsBranch(sessionId: string, nodeId: string, label?: string): Promise<string> {
    const rec = this.#require(sessionId);
    const parent = rec.tree.nodes[nodeId];
    if (!parent) throw new Error(`unknown node "${nodeId}" in session "${sessionId}"`);
    // §2.2: a retry forks a sibling carrying the SAME block — it never mutates
    // the parent. The old answer stays in the tree; the new branch is active.
    const newId = `${sessionId}-b${this.#nextSeq()}`;
    rec.tree.nodes[newId] = {
      id: newId,
      parentId: nodeId,
      block: parent.block,
      children: [],
      branchLabel: label ?? `retry ${parent.children.length + 1}`,
    };
    parent.children.push(newId);
    rec.tree.activeLeaf = newId;
    return newId;
  }

  async copy(sessionId: string, newTitle?: string): Promise<StoredSession> {
    const rec = this.#require(sessionId);
    const seq = this.#nextSeq();
    const newId = `sess-${seq}`;
    const session: StoredSession = {
      ...rec.session,
      id: newId,
      title: newTitle ?? `${rec.session.title} (copy)`,
      telemetry: { ...rec.session.telemetry },
      copiedFrom: sessionId,
      seq,
    };
    this.#sessions.set(newId, {
      session,
      blocks: [...rec.blocks],
      tree: cloneTree(rec.tree),
    });
    return { ...session };
  }

  async search(query: string): Promise<SessionSearchHit[]> {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const hits: SessionSearchHit[] = [];
    const ordered = [...this.#sessions.values()].sort((a, b) => a.session.seq - b.session.seq);
    for (const rec of ordered) {
      for (const block of rec.blocks) {
        const text = indexText(block);
        if (text.toLowerCase().includes(needle)) {
          hits.push({
            sessionId: rec.session.id,
            blockId: block.block.id,
            title: rec.session.title,
            snippet: snippetOf(text, needle),
          });
        }
      }
    }
    return Promise.resolve(hits);
  }
}

/** Deep-clone a session tree so reads never alias the live store. */
function cloneTree(tree: SessionTree): SessionTree {
  const nodes: Record<string, SessionNode> = {};
  for (const [id, node] of Object.entries(tree.nodes)) {
    nodes[id] = { ...node, children: [...node.children] };
  }
  return { nodes, roots: [...tree.roots], activeLeaf: tree.activeLeaf };
}

/** A short snippet centered on the match (deterministic, no ellipsis fuss). */
function snippetOf(text: string, needle: string): string {
  const i = text.toLowerCase().indexOf(needle);
  if (i === -1) return text.slice(0, 80);
  const start = Math.max(0, i - 24);
  const end = Math.min(text.length, i + needle.length + 24);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

/** Factory mirroring the other deterministic-fake constructors. */
export function createInMemorySessionStore(): SessionStore {
  return new InMemorySessionStore();
}
