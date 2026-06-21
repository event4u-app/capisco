import { beforeEach, describe, expect, it } from "vitest";
import { isFlyoutTool, PRESETS, TERMINAL_ID, useLayout } from "./store";

function reset() {
  useLayout.getState().applyPreset("default");
  useLayout.setState({
    mode: "agents",
    previousMode: "agents",
    terminalOpen: false,
    pinnedFlyouts: [],
    rTopActive: null,
    rBotActive: null,
  });
}

beforeEach(reset);

describe("layout store — drag & dock state machine", () => {
  it("reorders an icon within the same group (drop before)", () => {
    const { reorder } = useLayout.getState();
    reorder("pr", "leftTop", "explorer"); // move pr before explorer
    expect(useLayout.getState().groups.leftTop[0]).toBe("pr");
  });

  it("moves an icon across groups (left top → right top)", () => {
    useLayout.getState().reorder("search", "rightTop", null);
    expect(useLayout.getState().groups.leftTop).not.toContain("search");
    expect(useLayout.getState().groups.rightTop).toContain("search");
  });

  it("moves an icon across rails into the empty bottom group", () => {
    expect(useLayout.getState().groups.rightBottom).toHaveLength(0);
    useLayout.getState().reorder("data", "rightBottom", null);
    expect(useLayout.getState().groups.rightBottom).toEqual(["data"]);
    expect(useLayout.getState().groups.leftTop).not.toContain("data");
  });

  it("appends to the end when dropped on a group fill zone (beforeId null)", () => {
    const before = [...useLayout.getState().groups.leftTop];
    useLayout.getState().reorder("explorer", "leftTop", null);
    const after = useLayout.getState().groups.leftTop;
    expect(after[after.length - 1]).toBe("explorer");
    expect(after).toHaveLength(before.length);
  });

  it("keeps a dragged-while-active tool active in its new group", () => {
    useLayout.getState().select("explorer"); // topActive = explorer
    expect(useLayout.getState().topActive).toBe("explorer");
    useLayout.getState().reorder("explorer", "rightTop", null);
    expect(useLayout.getState().topActive).toBeNull();
    expect(useLayout.getState().rTopActive).toBe("explorer");
  });

  it("the terminal item carries its split boundary across groups", () => {
    expect(useLayout.getState().groups.leftBottom).toContain(TERMINAL_ID);
    useLayout.getState().reorder(TERMINAL_ID, "leftTop", "pr");
    expect(useLayout.getState().groups.leftTop).toContain(TERMINAL_ID);
    expect(useLayout.getState().groups.leftBottom).not.toContain(TERMINAL_ID);
  });
});

describe("layout store — selection / panels", () => {
  it("toggles a panel off when its active icon is re-selected", () => {
    useLayout.getState().select("pr");
    expect(useLayout.getState().topActive).toBe("pr");
    useLayout.getState().select("pr");
    expect(useLayout.getState().topActive).toBeNull();
  });
});

describe("layout store — terminal + splits persist via setters", () => {
  it("toggles terminal and stores its height + split ratios", () => {
    useLayout.getState().toggleTerminal();
    expect(useLayout.getState().terminalOpen).toBe(true);
    useLayout.getState().setTerminalHeight(333);
    expect(useLayout.getState().terminalHeight).toBe(333);
    useLayout.getState().setLeftSplit(0.7);
    expect(useLayout.getState().leftSplit).toBe(0.7);
  });
});

describe("layout store — presets & visibility (§5.4)", () => {
  it("the PO preset hides editor/debugger tools but keeps PR/Tasks docked", () => {
    useLayout.getState().applyPreset("po");
    const po = PRESETS.find((p) => p.id === "po")!;
    expect(useLayout.getState().hiddenTools).toEqual(po.hiddenTools);
    expect(useLayout.getState().groups.leftTop).toContain("pr");
    expect(useLayout.getState().groups.leftTop).toContain("tasks");
    expect(useLayout.getState().hiddenTools).toContain("explorer");
  });

  it("toggling visibility clears the active preset (custom layout)", () => {
    expect(useLayout.getState().activePreset).toBe("default");
    useLayout.getState().toggleToolVisibility("search");
    expect(useLayout.getState().hiddenTools).toContain("search");
    expect(useLayout.getState().activePreset).toBeNull();
  });
});

describe("layout store — flyout pin (R6 §2)", () => {
  it("flyout tools are alerts + inspect; normal tools are not", () => {
    expect(isFlyoutTool("alerts")).toBe(true);
    expect(isFlyoutTool("inspect")).toBe(true);
    expect(isFlyoutTool("data")).toBe(false);
    expect(isFlyoutTool(null)).toBe(false);
  });

  it("flyouts start unpinned (overlay) and toggle to pinned (docked)", () => {
    expect(useLayout.getState().pinnedFlyouts).not.toContain("alerts");
    useLayout.getState().togglePin("alerts");
    expect(useLayout.getState().pinnedFlyouts).toContain("alerts");
    useLayout.getState().togglePin("alerts");
    expect(useLayout.getState().pinnedFlyouts).not.toContain("alerts");
  });
});

describe("layout store — diff returns to previous mode", () => {
  it("remembers the mode it entered diff from", () => {
    useLayout.getState().setMode("git");
    useLayout.getState().setMode("diff");
    expect(useLayout.getState().previousMode).toBe("git");
    useLayout.getState().setMode(useLayout.getState().previousMode);
    expect(useLayout.getState().mode).toBe("git");
  });
});
