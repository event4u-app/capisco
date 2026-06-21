/**
 * Persistent Session-Store contract (B3 Phase 0, concept §2.2).
 *
 * "Ein ordentlicher Session-Store ab Tag eins ist Pflicht." Out of it fall:
 *  - **Resume**  = rehydrate a session (its records + tree) from the store.
 *  - **Search**  = a full-text index over message bodies / tool targets.
 *  - **Retry**   = *branches* the session tree, NEVER overwrites the parent
 *                  (§2.2 retry-as-branch — the old answer is preserved).
 *  - **Copy**    = trivial — deep-copy a stored session into a fresh id.
 *
 * The store is the durable home of the streaming surface defined in
 * `contracts/agents.ts`: a {@link StoredSession} owns its ordered
 * {@link TranscriptBlock}s, its {@link SessionTree}, its telemetry, and its
 * worktree coupling (§2.1 — a session acts in a workspace). The ACP transport
 * (Phase 1) appends records as events arrive; the UI reads them back through
 * `getTree` / `getBlocks` exactly as it reads the mock agent provider.
 *
 * DEFERRED: a disk-backed (SQLite / content-addressed) store is a thin swap
 * behind this contract. The shipped impl is a deterministic in-memory store the
 * build hermetically tests against (no Date.now / Math.random — a monotonic
 * `seq` orders records).
 */

import type {
  ModelId,
  SessionStatus,
  SessionTree,
  Telemetry,
  TranscriptBlock,
} from "./agents.ts";

/** A persisted session record — everything resume needs to rehydrate one run. */
export interface StoredSession {
  id: string;
  model: ModelId;
  status: SessionStatus;
  title: string;
  /** Structured run telemetry, aggregating subagents (§2 / Phase 1). */
  telemetry: Telemetry;
  /**
   * Worktree the session acts in (§2.1 — place ↔ conversation coupling). The
   * absolute checkout path; undefined for a session not yet bound to a worktree.
   */
  worktreePath?: string;
  /** Parent session id when this session is a copy / retry origin (provenance). */
  copiedFrom?: string;
  /** Monotonic creation ordinal — deterministic ordering, never wall-clock. */
  seq: number;
}

/** One full-text search hit — the session + the block that matched + a snippet. */
export interface SessionSearchHit {
  sessionId: string;
  /** The matching block's node id (transcript block id). */
  blockId: string;
  /** The session title (for the result row). */
  title: string;
  /** The matched text snippet (message body or tool target). */
  snippet: string;
}

/** A rehydrated session — its record plus its ordered blocks and branching tree. */
export interface ResumedSession {
  session: StoredSession;
  blocks: TranscriptBlock[];
  tree: SessionTree;
}

/**
 * The persistent session store. Append records as a run streams; read them back
 * for resume; index them for search; branch the tree for retry; copy a whole
 * session. Every method is a `Promise` (the real disk-backed store is async I/O;
 * the in-memory fake resolves immediately, deterministically).
 */
export interface SessionStore {
  /** Create a new session record. Resolves the stored session (with its `seq`). */
  create(input: {
    id?: string;
    model: ModelId;
    title: string;
    status?: SessionStatus;
    worktreePath?: string;
  }): Promise<StoredSession>;
  /** List every stored session, ordered by creation `seq`. */
  list(): Promise<StoredSession[]>;
  /** One stored session record, or null if unknown. */
  get(sessionId: string): Promise<StoredSession | null>;
  /**
   * Append a transcript block to a session: persists the block, extends the
   * linear tree (the block becomes the active leaf), and indexes its text for
   * search. Resolves the appended node id.
   */
  append(sessionId: string, block: TranscriptBlock): Promise<string>;
  /** Replace a session's telemetry / status (a `telemetry` / `status` event). */
  update(
    sessionId: string,
    patch: Partial<Pick<StoredSession, "status" | "telemetry" | "title" | "worktreePath">>,
  ): Promise<void>;
  /**
   * Resume = rehydrate a session from the store: its record, ordered blocks, and
   * branching tree. Throws for an unknown session.
   */
  resume(sessionId: string): Promise<ResumedSession>;
  /**
   * Retry-as-branch (§2.2): fork the tree at `nodeId` and append a sibling node
   * carrying the same block — it NEVER overwrites the parent; the old answer is
   * preserved. The new node becomes the active leaf. Resolves the new node id.
   */
  retryAsBranch(sessionId: string, nodeId: string, label?: string): Promise<string>;
  /**
   * Copy a whole session into a fresh id (records + blocks + tree). The copy's
   * `copiedFrom` records provenance. Resolves the new session.
   */
  copy(sessionId: string, newTitle?: string): Promise<StoredSession>;
  /**
   * Full-text search over indexed message bodies + tool targets. Case-insensitive
   * substring match; results ordered by session `seq` then block order.
   */
  search(query: string): Promise<SessionSearchHit[]>;
}
