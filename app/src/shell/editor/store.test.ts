import { beforeEach, describe, expect, it } from "vitest";
import { useEditor } from "./store";
import { editorSnapshot, mockEditorProvider } from "@/mocks";

function reset() {
  const tabs = editorSnapshot.getDocs().map((d) => ({
    file: d.file,
    ext: d.ext,
    label: d.file,
    pinned: !!d.pinned,
    dirty: !!d.dirty,
  }));
  useEditor.setState({ tabs, activeFile: tabs[0].file });
}

describe("editor tab-strip store", () => {
  beforeEach(reset);

  it("initialises tabs deterministically from the mock provider", async () => {
    const a = await mockEditorProvider.getDocs();
    const b = await mockEditorProvider.getDocs();
    expect(a).toEqual(b); // no Date.now / Math.random
    // Leading docs are stable (broker pinned + active, worktree dirty, types);
    // Design-Sync P1 appends extra tabs so the overflow dropdown has something
    // to fold.
    const files = useEditor.getState().tabs.map((t) => t.file);
    expect(files.slice(0, 3)).toEqual(["broker.ts", "worktree.ts", "types.ts"]);
    expect(files.length).toBeGreaterThan(3);
    expect(files).toContain("ListProjectsControllerTest.ts");
    // broker.ts ships pinned, worktree.ts dirty (from the doc shape).
    expect(useEditor.getState().tabs[0].pinned).toBe(true);
    expect(useEditor.getState().tabs[1].dirty).toBe(true);
  });

  it("toggles pin and renames a tab", () => {
    const { togglePin, rename } = useEditor.getState();
    togglePin("worktree.ts");
    expect(useEditor.getState().tabs.find((t) => t.file === "worktree.ts")!.pinned).toBe(true);
    rename("types.ts", "shared types");
    expect(useEditor.getState().tabs.find((t) => t.file === "types.ts")!.label).toBe(
      "shared types",
    );
  });

  it("reorders a tab before another", () => {
    useEditor.getState().reorder("types.ts", "broker.ts");
    expect(
      useEditor
        .getState()
        .tabs.map((t) => t.file)
        .slice(0, 3),
    ).toEqual(["types.ts", "broker.ts", "worktree.ts"]);
  });

  it("closing the active tab advances the active selection", () => {
    useEditor.getState().setActive("worktree.ts");
    useEditor.getState().closeTab("worktree.ts");
    const files = useEditor.getState().tabs.map((t) => t.file);
    expect(files).not.toContain("worktree.ts");
    expect(files.slice(0, 2)).toEqual(["broker.ts", "types.ts"]);
    // Active advances to the tab that took the closed tab's slot.
    expect(useEditor.getState().activeFile).toBe("types.ts");
  });
});

describe("mock editor provider (provider-output contract, async)", () => {
  it("returns completions, hints, blame, presence, folds and change bars for broker.ts", async () => {
    expect((await mockEditorProvider.getCompletions("broker.ts", 18))[0].label).toBe("prompt");
    expect((await mockEditorProvider.getInlayHints("broker.ts")).length).toBeGreaterThan(0);
    expect((await mockEditorProvider.getBlame("broker.ts"))[0]).toMatchObject({
      line: 18,
      author: "matze",
    });
    const pres = (await mockEditorProvider.getPresence("broker.ts"))[0];
    expect(pres).toMatchObject({ who: "mara", init: "ma", fromLine: 16, toLine: 17 });
    expect(pres.diff.length).toBe(3);
    expect((await mockEditorProvider.getFolds("broker.ts")).length).toBe(2);
    expect(
      (await mockEditorProvider.getChangeBars("broker.ts")).some((b) => b.kind === "M"),
    ).toBe(true);
    expect(await mockEditorProvider.getActiveLine("broker.ts")).toBe(18);
  });

  it("returns empty provider outputs for non-broker files (no fake LSP)", async () => {
    expect(await mockEditorProvider.getCompletions("types.ts", 1)).toEqual([]);
    expect(await mockEditorProvider.getPresence("types.ts")).toEqual([]);
    expect(await mockEditorProvider.getBlame("types.ts")).toEqual([]);
  });
});
