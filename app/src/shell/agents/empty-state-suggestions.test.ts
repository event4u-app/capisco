/**
 * Unit tests for the P3 empty-state suggestion builder + hook.
 *
 * The builder is pure — tested directly against fabricated sources. The hook is
 * tested through the real deterministic mocks (`editorSnapshot` / `mockChangeSet`)
 * so the agent-vs-chat mode cut and the prompt-log wiring are verified end-to-end.
 */

import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import type { EditorDoc } from "@/contracts";
import { buildEmptyStateSuggestions } from "./empty-state-suggestions.ts";
import { useEmptyStateSuggestions } from "./use-empty-state-suggestions.ts";

const doc = (file: string, text = "", extra: Partial<EditorDoc> = {}): EditorDoc => ({
  file,
  ext: file.split(".").pop() ?? "",
  text,
  ...extra,
});

describe("buildEmptyStateSuggestions (pure)", () => {
  it("returns [] when every source is empty", () => {
    expect(
      buildEmptyStateSuggestions({
        recentPrompts: [],
        editorDocs: [],
        currentBranch: "",
        changedFileCount: 0,
        isChat: false,
      }),
    ).toEqual([]);
  });

  it("surfaces up to 2 recent prompts, most-recent-first, with the full text as fill", () => {
    const rows = buildEmptyStateSuggestions({
      recentPrompts: ["first", "second", "third"],
      editorDocs: [],
      currentBranch: "",
      changedFileCount: 0,
      isChat: true,
    });
    expect(rows.map((r) => r.kind)).toEqual(["recent-prompt", "recent-prompt"]);
    expect(rows.map((r) => r.fill)).toEqual(["first", "second"]);
  });

  it("truncates a long prompt label but keeps the full fill text", () => {
    const long = "x".repeat(120);
    const [row] = buildEmptyStateSuggestions({
      recentPrompts: [long],
      editorDocs: [],
      currentBranch: "",
      changedFileCount: 0,
      isChat: false,
    });
    expect(row.label.length).toBeLessThan(long.length);
    expect(row.label.endsWith("…")).toBe(true);
    expect(row.fill).toBe(long);
  });

  it("agent mode surfaces the dirty file + git-branch rows", () => {
    const rows = buildEmptyStateSuggestions({
      recentPrompts: [],
      editorDocs: [doc("a.ts"), doc("b.ts", "", { dirty: true })],
      currentBranch: "feat/x",
      changedFileCount: 3,
      isChat: false,
    });
    const file = rows.find((r) => r.kind === "open-file");
    const git = rows.find((r) => r.kind === "git-branch");
    expect(file?.label).toContain("b.ts"); // the dirty doc wins over the frontmost
    expect(git?.label).toContain("3 changes on feat/x");
  });

  it("chat mode suppresses file + git rows", () => {
    const rows = buildEmptyStateSuggestions({
      recentPrompts: ["hi"],
      editorDocs: [doc("a.ts", "", { dirty: true })],
      currentBranch: "feat/x",
      changedFileCount: 3,
      isChat: true,
    });
    expect(rows.some((r) => r.kind === "open-file")).toBe(false);
    expect(rows.some((r) => r.kind === "git-branch")).toBe(false);
    expect(rows.some((r) => r.kind === "recent-prompt")).toBe(true);
  });

  it("parses one unchecked ToDo from the frontmost doc, skipping checked ones", () => {
    const md = "- [x] done item\n- [ ] open item\n- [ ] second open";
    const rows = buildEmptyStateSuggestions({
      recentPrompts: [],
      editorDocs: [doc("notes.md", md)],
      currentBranch: "",
      changedFileCount: 0,
      isChat: true,
    });
    const todo = rows.find((r) => r.kind === "open-todo");
    expect(todo?.fill).toBe("open item");
  });

  it("caps the list at 5 rows", () => {
    const rows = buildEmptyStateSuggestions({
      recentPrompts: ["a", "b"],
      editorDocs: [doc("notes.md", "- [ ] t", { dirty: true })],
      currentBranch: "feat/x",
      changedFileCount: 9,
      isChat: false,
    });
    expect(rows.length).toBeLessThanOrEqual(5);
  });
});

describe("useEmptyStateSuggestions (hook, real mocks)", () => {
  it("agent mode yields the open-file + git-branch rows from the deterministic mocks", () => {
    const { result } = renderHook(() =>
      useEmptyStateSuggestions({ promptLogs: {}, sessionId: "s1", isChat: false }),
    );
    const kinds = result.current.map((r) => r.kind);
    expect(kinds).toContain("open-file");
    expect(kinds).toContain("git-branch");
  });

  it("chat mode with no history yields no rows (no tool/context sources)", () => {
    const { result } = renderHook(() =>
      useEmptyStateSuggestions({ promptLogs: {}, sessionId: "s1", isChat: true }),
    );
    expect(result.current).toEqual([]);
  });

  it("reads recent prompts from the session's log, most-recent-first", () => {
    const { result } = renderHook(() =>
      useEmptyStateSuggestions({
        promptLogs: { s1: ["older", "newer"] },
        sessionId: "s1",
        isChat: true,
      }),
    );
    const recents = result.current.filter((r) => r.kind === "recent-prompt");
    expect(recents.map((r) => r.fill)).toEqual(["newer", "older"]);
  });
});
