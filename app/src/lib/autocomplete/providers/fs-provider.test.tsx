import { describe, expect, it, vi, beforeEach } from "vitest";
import type { FsTreeNode } from "@/contracts/fs-tree";
import type { ActiveToken } from "@/lib/mention/token-detector";
import { makeFsProvider, type FsItem } from "./fs-provider";

// ---------------------------------------------------------------------------
// Mock desktop-shell so getTree never hits the real sidecar.
// ---------------------------------------------------------------------------

const getTreeMock = vi.fn();

vi.mock("@/lib/desktop-shell", () => ({
  getProviders: () => ({
    projectFs: { getTree: getTreeMock },
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fileNode: FsTreeNode = {
  relPath: "src/a.ts",
  name: "a.ts",
  isDir: false,
  ext: "ts",
  depth: 1,
};

const dirNode: FsTreeNode = {
  relPath: "src",
  name: "src",
  isDir: true,
  ext: "dir",
  depth: 0,
};

const FIXTURE: FsTreeNode[] = [fileNode, dirNode];
const ROOT = "/repo";

beforeEach(() => {
  getTreeMock.mockReset();
  getTreeMock.mockResolvedValue(FIXTURE);
});

// ---------------------------------------------------------------------------
// getItems — mapping
// ---------------------------------------------------------------------------

describe("makeFsProvider — getItems mapping", () => {
  it("maps nodes to FsItems with correct id, label and absPath", async () => {
    const p = makeFsProvider({ projectRoot: ROOT, onAttach: vi.fn() });
    const items = (await p.getItems("")) as FsItem[];

    const file = items.find((i) => i.id === "src/a.ts");
    expect(file).toBeDefined();
    expect(file!.label).toBe("a.ts");
    expect(file!.absPath).toBe(`${ROOT}/src/a.ts`);
    expect(file!.node).toBe(fileNode);

    const dir = items.find((i) => i.id === "src");
    expect(dir).toBeDefined();
    expect(dir!.label).toBe("src");
    expect(dir!.absPath).toBe(`${ROOT}/src`);
    expect(dir!.node).toBe(dirNode);
  });

  it("returns both file and dir nodes (engine does the filtering)", async () => {
    const p = makeFsProvider({ projectRoot: ROOT, onAttach: vi.fn() });
    const items = (await p.getItems("")) as FsItem[];
    expect(items).toHaveLength(2);
  });

  it("mruScore is 0 for every item", async () => {
    const p = makeFsProvider({ projectRoot: ROOT, onAttach: vi.fn() });
    const items = (await p.getItems("")) as FsItem[];
    for (const item of items) expect(item.mruScore).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getItems — caching (getTree called ONCE per instance)
// ---------------------------------------------------------------------------

describe("makeFsProvider — tree caching", () => {
  it("calls getTree exactly once across multiple getItems calls", async () => {
    const p = makeFsProvider({ projectRoot: ROOT, onAttach: vi.fn() });
    await p.getItems("a");
    await p.getItems("b");
    await p.getItems("");
    expect(getTreeMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getItems — empty projectRoot guard
// ---------------------------------------------------------------------------

describe("makeFsProvider — empty projectRoot", () => {
  it("returns [] without calling getTree when projectRoot is empty", async () => {
    const p = makeFsProvider({ projectRoot: "", onAttach: vi.fn() });
    const items = await p.getItems("anything");
    expect(items).toEqual([]);
    expect(getTreeMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onSelect — insertion and side-effect
// ---------------------------------------------------------------------------

describe("makeFsProvider — onSelect", () => {
  const token: ActiveToken = { trigger: "@", query: "a", start: 0, end: 2 };

  it("inserts @label + space for a file item", async () => {
    const onAttach = vi.fn();
    const p = makeFsProvider({ projectRoot: ROOT, onAttach });
    const items = (await p.getItems("")) as FsItem[];
    const fileItem = items.find((i) => i.id === "src/a.ts")!;

    const res = p.onSelect(fileItem, token, "@a rest");
    expect(res.text).toBe("@a.ts  rest");
    expect(res.caret).toBe("@a.ts ".length);
  });

  it("file selection produces a sideEffect that calls onAttach with absPath", async () => {
    const onAttach = vi.fn();
    const p = makeFsProvider({ projectRoot: ROOT, onAttach });
    const items = (await p.getItems("")) as FsItem[];
    const fileItem = items.find((i) => i.id === "src/a.ts")!;

    const res = p.onSelect(fileItem, token, "@a");
    expect(res.sideEffect).toBeDefined();
    res.sideEffect?.();
    expect(onAttach).toHaveBeenCalledWith(`${ROOT}/src/a.ts`);
  });

  it("folder selection produces NO sideEffect", async () => {
    const onAttach = vi.fn();
    const p = makeFsProvider({ projectRoot: ROOT, onAttach });
    const items = (await p.getItems("")) as FsItem[];
    const dirItem = items.find((i) => i.id === "src")!;

    const res = p.onSelect(dirItem, token, "@s");
    expect(res.sideEffect).toBeUndefined();
    // onAttach must not have been called either
    expect(onAttach).not.toHaveBeenCalled();
  });
});
