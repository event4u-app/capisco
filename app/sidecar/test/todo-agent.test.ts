/**
 * ToDo → Agent micro-north-star integration test (B3 Phase 2, concept §4.11).
 *
 * Proves the smallest vertical slice end-to-end: a clickable markdown `- [ ]`
 * item → "send to agent" → a BROKER-GATED stub ACP session in the current
 * worktree → status open → in-progress → done, with the run streaming into the
 * persistent (resumable / searchable) session store. No LLM key, no real agent.
 */

import { describe, expect, it } from "vitest";
import { Broker } from "../broker/capability-broker.ts";
import { InMemorySessionStore } from "../session/in-memory-session-store.ts";
import { TodoProviderImpl } from "../todo/todo-provider.ts";
import { createAcpTodoStarter } from "../todo/acp-todo-starter.ts";
import { parseTodos } from "@/lib/todo/todo-parser.ts";
import type { PermissionResolver } from "../acp/acp-session.ts";

const ALLOW_ALL: PermissionResolver = () => ({ axis: "session" });

const MARKDOWN = `# Today

- [ ] Implement worktree teardown
  - [x] already done thing
* [ ] Free the allocated port
1. [ ] ordered-list todo
not a todo line
`;

describe("markdown ToDo parser (§4.11)", () => {
  it("parses clickable `- [ ]` items with line numbers + checked state", () => {
    const items = parseTodos("notes.md", MARKDOWN);
    expect(items.map((i) => i.text)).toEqual([
      "Implement worktree teardown",
      "already done thing",
      "Free the allocated port",
      "ordered-list todo",
    ]);
    expect(items.find((i) => i.text === "already done thing")?.checked).toBe(true);
    expect(items[0].line).toBe(3);
    expect(items[0].id).toBe("notes.md:3");
  });

  it("ignores non-todo lines", () => {
    expect(parseTodos("x.md", "just prose\n- a bullet\n").length).toBe(0);
  });
});

describe("ToDo → Agent (broker-gated, current worktree)", () => {
  it("flips open → in-progress → done and streams into the session store", async () => {
    const broker = new Broker();
    const store = new InMemorySessionStore();
    const performed: string[] = [];
    const starter = createAcpTodoStarter({
      broker,
      store,
      resolvePermission: ALLOW_ALL,
      perform: (call) => performed.push(`${call.kind}:${call.target}`),
    });
    const todo = new TodoProviderImpl(store, starter);

    const [item] = parseTodos("notes.md", MARKDOWN);

    // Before sending: open.
    expect(await todo.statusOf(item.id)).toBe("open");

    const sessionId = await todo.sendToAgent(item, "/repo/.worktrees/current");

    // After completion: done, linked to a resumable session in the worktree.
    expect(await todo.statusOf(item.id)).toBe("done");
    const stored = await store.get(sessionId);
    expect(stored?.worktreePath).toBe("/repo/.worktrees/current");
    expect(stored?.title).toBe("Implement worktree teardown");
    expect(stored?.status).toBe("done");

    // The run went through the broker (the read + the allowed write).
    expect(performed).toEqual(["file-read:README.md", "file-write:TODO-done.md"]);

    // The triggered session is searchable + resumable (§2.2).
    const resumed = await store.resume(sessionId);
    expect(resumed.blocks.length).toBeGreaterThan(0);
    const hits = await store.search("TODO-done.md");
    expect(hits.some((h) => h.sessionId === sessionId)).toBe(true);
  });

  it("list() surfaces the ToDo's live status + linked session after sending", async () => {
    const broker = new Broker();
    const store = new InMemorySessionStore();
    const starter = createAcpTodoStarter({ broker, store, resolvePermission: ALLOW_ALL });
    const todo = new TodoProviderImpl(store, starter);

    const before = await todo.list("notes.md", MARKDOWN);
    expect(before[0].status).toBe("open");
    expect(before[0].sessionId).toBeUndefined();

    const item = before[0];
    const sessionId = await todo.sendToAgent(item, "/repo/.worktrees/current");

    const after = await todo.list("notes.md", MARKDOWN);
    expect(after[0].status).toBe("done");
    expect(after[0].sessionId).toBe(sessionId);
  });

  it("a failed agent start reverts the ToDo to open — never silently done", async () => {
    const store = new InMemorySessionStore();
    // To prove the revert path we make the STARTER throw (agent failed to spawn).
    const starter = (): Promise<string> => Promise.reject(new Error("agent failed to start"));
    const todo = new TodoProviderImpl(store, starter);
    const [item] = parseTodos("notes.md", MARKDOWN);

    await expect(todo.sendToAgent(item, "/repo/.worktrees/current")).rejects.toThrow();
    expect(await todo.statusOf(item.id)).toBe("open");
  });
});
