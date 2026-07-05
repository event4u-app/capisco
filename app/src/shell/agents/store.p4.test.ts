/**
 * Input-reliability P4 — store slice tests.
 *
 * Covers:
 *  - `appendPrompt`: FIFO cap at 100, blank text ignored, per-session isolation.
 *  - `saveDraft`: truncation at 10 000 chars, empty/whitespace deletes the key.
 *  - `clearDraft`: removes the key.
 *  - `sessionPromptLog` selector: empty default, most-recent-last order.
 *  - `recentPrompts` selector: most-recent-first, honours `n` param.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useAgents } from "./store.ts";
import { sessionPromptLog, recentPrompts } from "./store.ts";

// Reset the store to initial state before every test so tests are independent.
beforeEach(() => {
  useAgents.setState({ promptLogs: {}, draftBodies: {} });
});

// ──────────────────────────────────────────────────────────────────────────────
// appendPrompt
// ──────────────────────────────────────────────────────────────────────────────

describe("appendPrompt", () => {
  it("appends a prompt to an initially empty log", () => {
    useAgents.getState().appendPrompt("s1", "hello world");
    expect(useAgents.getState().promptLogs["s1"]).toEqual(["hello world"]);
  });

  it("keeps entries in most-recent-last order", () => {
    const { appendPrompt } = useAgents.getState();
    appendPrompt("s1", "first");
    appendPrompt("s1", "second");
    appendPrompt("s1", "third");
    expect(useAgents.getState().promptLogs["s1"]).toEqual(["first", "second", "third"]);
  });

  it("silently ignores blank text (whitespace-only)", () => {
    useAgents.getState().appendPrompt("s1", "   ");
    expect(useAgents.getState().promptLogs["s1"]).toBeUndefined();
  });

  it("silently ignores empty string", () => {
    useAgents.getState().appendPrompt("s1", "");
    expect(useAgents.getState().promptLogs["s1"]).toBeUndefined();
  });

  it("caps the log at 100 entries (FIFO — oldest dropped first)", () => {
    const { appendPrompt } = useAgents.getState();
    for (let i = 0; i < 105; i++) {
      appendPrompt("s1", `prompt-${i}`);
    }
    const log = useAgents.getState().promptLogs["s1"]!;
    expect(log).toHaveLength(100);
    // The 5 oldest entries (0–4) were dropped; entry at index 0 is now prompt-5.
    expect(log[0]).toBe("prompt-5");
    expect(log[99]).toBe("prompt-104");
  });

  it("isolates logs per session", () => {
    const { appendPrompt } = useAgents.getState();
    appendPrompt("s1", "for s1");
    appendPrompt("s2", "for s2");
    expect(useAgents.getState().promptLogs["s1"]).toEqual(["for s1"]);
    expect(useAgents.getState().promptLogs["s2"]).toEqual(["for s2"]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// saveDraft
// ──────────────────────────────────────────────────────────────────────────────

describe("saveDraft", () => {
  it("stores a non-empty draft", () => {
    useAgents.getState().saveDraft("s1", "my unsent message");
    expect(useAgents.getState().draftBodies["s1"]).toBe("my unsent message");
  });

  it("truncates at MAX_DRAFT_CHARS (10 000)", () => {
    const longBody = "x".repeat(12_000);
    useAgents.getState().saveDraft("s1", longBody);
    expect(useAgents.getState().draftBodies["s1"]).toHaveLength(10_000);
  });

  it("deletes the key when body is empty string", () => {
    useAgents.getState().saveDraft("s1", "something");
    useAgents.getState().saveDraft("s1", "");
    expect(useAgents.getState().draftBodies["s1"]).toBeUndefined();
  });

  it("deletes the key when body is whitespace-only", () => {
    useAgents.getState().saveDraft("s1", "something");
    useAgents.getState().saveDraft("s1", "   \n  ");
    expect(useAgents.getState().draftBodies["s1"]).toBeUndefined();
  });

  it("never stores an empty string — the key is absent", () => {
    useAgents.getState().saveDraft("s1", "");
    const drafts = useAgents.getState().draftBodies;
    expect("s1" in drafts).toBe(false);
  });

  it("isolates drafts per session", () => {
    useAgents.getState().saveDraft("s1", "draft for s1");
    useAgents.getState().saveDraft("s2", "draft for s2");
    expect(useAgents.getState().draftBodies["s1"]).toBe("draft for s1");
    expect(useAgents.getState().draftBodies["s2"]).toBe("draft for s2");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// clearDraft
// ──────────────────────────────────────────────────────────────────────────────

describe("clearDraft", () => {
  it("removes the draft key", () => {
    useAgents.getState().saveDraft("s1", "hello");
    useAgents.getState().clearDraft("s1");
    expect(useAgents.getState().draftBodies["s1"]).toBeUndefined();
  });

  it("is idempotent when no draft exists", () => {
    expect(() => useAgents.getState().clearDraft("nonexistent")).not.toThrow();
  });

  it("does not affect other sessions", () => {
    useAgents.getState().saveDraft("s1", "keep me");
    useAgents.getState().saveDraft("s2", "remove me");
    useAgents.getState().clearDraft("s2");
    expect(useAgents.getState().draftBodies["s1"]).toBe("keep me");
    expect(useAgents.getState().draftBodies["s2"]).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// sessionPromptLog selector
// ──────────────────────────────────────────────────────────────────────────────

describe("sessionPromptLog selector", () => {
  it("returns [] for an unknown session", () => {
    const state = useAgents.getState();
    expect(sessionPromptLog(state, "unknown")).toEqual([]);
  });

  it("returns the log in most-recent-last order", () => {
    const { appendPrompt } = useAgents.getState();
    appendPrompt("s1", "a");
    appendPrompt("s1", "b");
    appendPrompt("s1", "c");
    const log = sessionPromptLog(useAgents.getState(), "s1");
    expect(log).toEqual(["a", "b", "c"]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// recentPrompts selector
// ──────────────────────────────────────────────────────────────────────────────

describe("recentPrompts selector", () => {
  it("returns [] for an unknown session", () => {
    expect(recentPrompts(useAgents.getState(), "unknown")).toEqual([]);
  });

  it("returns entries in most-recent-first order", () => {
    const { appendPrompt } = useAgents.getState();
    appendPrompt("s1", "oldest");
    appendPrompt("s1", "middle");
    appendPrompt("s1", "newest");
    const recent = recentPrompts(useAgents.getState(), "s1");
    expect(recent[0]).toBe("newest");
    expect(recent[1]).toBe("middle");
    expect(recent[2]).toBe("oldest");
  });

  it("honours the n parameter", () => {
    const { appendPrompt } = useAgents.getState();
    for (let i = 1; i <= 10; i++) appendPrompt("s1", `p${i}`);
    const recent = recentPrompts(useAgents.getState(), "s1", 3);
    expect(recent).toHaveLength(3);
    expect(recent[0]).toBe("p10");
    expect(recent[1]).toBe("p9");
    expect(recent[2]).toBe("p8");
  });

  it("returns all entries when n exceeds log length", () => {
    useAgents.getState().appendPrompt("s1", "only");
    const recent = recentPrompts(useAgents.getState(), "s1", 10);
    expect(recent).toEqual(["only"]);
  });
});
