/**
 * Composer-intelligence S9 — saved-prompts store slice.
 *
 * Covers `savePrompt` (trim, dedupe-by-body, auto-label from the first line)
 * and `deleteSavedPrompt`. Saved prompts are the curated `/`-autocomplete set —
 * distinct from the ephemeral prompt log reached via ↑-recall / Cmd+R.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useAgents } from "./store.ts";

beforeEach(() => {
  useAgents.setState({ savedPrompts: [] });
});

describe("savePrompt", () => {
  it("saves a trimmed prompt and derives a label from the first line", () => {
    useAgents.getState().savePrompt("  Review the diff for regressions\nand list them  ");
    const [entry] = useAgents.getState().savedPrompts;
    expect(entry.body).toBe("Review the diff for regressions\nand list them");
    expect(entry.label).toBe("Review the diff for regressions");
    expect(entry.id).toMatch(/^sp\d+$/);
  });

  it("ignores a blank body", () => {
    useAgents.getState().savePrompt("   \n  ");
    expect(useAgents.getState().savedPrompts).toEqual([]);
  });

  it("dedupes by trimmed body — the same prompt is not saved twice", () => {
    const s = useAgents.getState();
    s.savePrompt("do the thing");
    s.savePrompt("  do the thing  ");
    expect(useAgents.getState().savedPrompts).toHaveLength(1);
  });

  it("honours an explicit label and clips a long auto-label to 60 chars", () => {
    const s = useAgents.getState();
    s.savePrompt("some body", "My template");
    const long = "x".repeat(80);
    s.savePrompt(long);
    const saved = useAgents.getState().savedPrompts;
    expect(saved[0].label).toBe("My template");
    expect(saved[1].label).toHaveLength(60);
  });
});

describe("deleteSavedPrompt", () => {
  it("removes only the targeted entry", () => {
    const s = useAgents.getState();
    s.savePrompt("alpha");
    s.savePrompt("beta");
    const [first] = useAgents.getState().savedPrompts;
    useAgents.getState().deleteSavedPrompt(first.id);
    expect(useAgents.getState().savedPrompts.map((p) => p.body)).toEqual(["beta"]);
  });
});
