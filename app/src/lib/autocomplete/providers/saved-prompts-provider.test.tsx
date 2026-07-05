import { describe, expect, it } from "vitest";
import type { ActiveToken } from "@/lib/mention/token-detector";
import type { SavedPrompt } from "@/shell/agents/store";
import { makeSavedPromptsProvider, type SavedPromptItem } from "./saved-prompts-provider";

const saved: SavedPrompt[] = [
  { id: "sp1", label: "Review diff", body: "Review the diff and list regressions" },
  { id: "sp2", label: "Write tests", body: "Write vitest tests for the changed files" },
];

describe("makeSavedPromptsProvider — getItems", () => {
  it("surfaces every saved prompt on the `/` trigger (engine ranks)", () => {
    const p = makeSavedPromptsProvider({ getSaved: () => saved });
    expect(p.triggerChar).toBe("/");
    const items = p.getItems("") as SavedPromptItem[];
    expect(items.map((i) => i.id)).toEqual(["saved:sp1", "saved:sp2"]);
    expect(items.map((i) => i.label)).toEqual(["Review diff", "Write tests"]);
    for (const i of items) expect(i.mruScore).toBe(0);
  });

  it("returns nothing when no prompts are saved (golden-safe empty)", () => {
    const p = makeSavedPromptsProvider({ getSaved: () => [] });
    expect(p.getItems("")).toEqual([]);
  });

  it("snapshots the list at query time (late binding via getSaved)", () => {
    let list: SavedPrompt[] = [];
    const p = makeSavedPromptsProvider({ getSaved: () => list });
    expect(p.getItems("")).toHaveLength(0);
    list = saved;
    expect(p.getItems("")).toHaveLength(2);
  });
});

describe("makeSavedPromptsProvider — onSelect (fills, never sends)", () => {
  it("replaces the /query token with the prompt body and puts the caret at its end", () => {
    const p = makeSavedPromptsProvider({ getSaved: () => saved });
    const item = (p.getItems("") as SavedPromptItem[])[0];
    const token: ActiveToken = { trigger: "/", query: "rev", start: 0, end: 4 };
    const res = p.onSelect(item, token, "/rev trailing");
    expect(res.text).toBe("Review the diff and list regressions trailing");
    expect(res.caret).toBe("Review the diff and list regressions".length);
    expect(res.sideEffect).toBeUndefined();
  });

  it("preserves buffer text before the trigger", () => {
    const p = makeSavedPromptsProvider({ getSaved: () => saved });
    const item = (p.getItems("") as SavedPromptItem[])[1];
    const token: ActiveToken = { trigger: "/", query: "", start: 6, end: 7 };
    const res = p.onSelect(item, token, "hello /");
    expect(res.text).toBe("hello Write vitest tests for the changed files");
  });
});
