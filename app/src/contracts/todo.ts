/**
 * ToDo-Provider contract (B3 Phase 2 — the micro-north-star, concept §4.11).
 *
 * "Statt Copy-Paste wird die ToDo-Zeile direkt aktionabel." Clickable markdown
 * ToDo items (`- [ ] …`) become agent runs: one click → a broker-gated stub ACP
 * session in the *current* worktree → status feedback (open → in progress →
 * done). It is the smallest vertical slice of "structured content → agent
 * action" — it invents NO new primitive, it composes the markdown editor with
 * the session tree + ACP + broker.
 *
 * Status coupling mirrors the ticket loop (§4.5) but lightweight + local: a sent
 * ToDo stays linked to the session it triggered, and the session's status drives
 * the ToDo's status.
 */

/** A parsed markdown ToDo item from a `- [ ]` / `- [x]` line. */
export interface TodoItem {
  /** Stable id (file path + line index). */
  id: string;
  /** The ToDo text after the checkbox (the agent prompt). */
  text: string;
  /** Whether the markdown checkbox was already checked (`- [x]`). */
  checked: boolean;
  /** 1-based source line in the file (clickable target). */
  line: number;
}

/** Lifecycle status of a ToDo, coupled to its triggered session (§4.5-lite). */
export type TodoStatus = "open" | "in-progress" | "done";

/** A ToDo plus its live status + the session it triggered (if any). */
export interface TodoView extends TodoItem {
  status: TodoStatus;
  /** The store session id this ToDo was sent to (undefined until sent). */
  sessionId?: string;
}

/**
 * Parse the `- [ ]` / `- [x]` ToDo lines out of a markdown document. Pure: the
 * editor calls it on the open buffer; the result drives the clickable list.
 */
export interface TodoParser {
  parse(filePath: string, markdown: string): TodoItem[];
}

/**
 * The ToDo provider: parse a markdown file, then send an item "to an agent" —
 * which starts a broker-gated session in the current worktree and tracks its
 * status. The agent run is the deterministic stub (real CLIs deferred).
 */
export interface TodoProvider {
  /** Parsed + status-augmented ToDo items for a markdown file. */
  list(filePath: string, markdown: string): Promise<TodoView[]>;
  /**
   * "An Agent senden": start a broker-gated stub session in `worktreePath` with
   * the ToDo text as the prompt. Flips the ToDo open → in-progress immediately,
   * and → done when the session completes. Resolves the triggered session id.
   */
  sendToAgent(item: TodoItem, worktreePath: string): Promise<string>;
  /** Current status of a ToDo (open until sent, then driven by its session). */
  statusOf(todoId: string): Promise<TodoStatus>;
}
