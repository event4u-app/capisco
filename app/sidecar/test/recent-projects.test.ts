import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createFileRecentProjects } from "../recent/recent-projects.ts";

let dir: string;
let filePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "capisco-recent-"));
  filePath = join(dir, "nested", "recent-projects.json");
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("file-backed Recent-Projects registry (B0 Phase 2)", () => {
  it("starts empty and creates the file (and dirs) on first touch", async () => {
    const store = createFileRecentProjects({ filePath });
    expect(await store.list()).toEqual([]);
    expect(existsSync(filePath)).toBe(false);
    await store.touch({ path: "/work/a", instanceId: "w1" });
    expect(existsSync(filePath)).toBe(true);
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("a"); // defaulted from basename
    expect(list[0].active).toBe(true);
  });

  it("merges by path (update in place, never duplicate)", async () => {
    const store = createFileRecentProjects({ filePath });
    await store.touch({ path: "/work/a", instanceId: "w1", branch: "main" });
    await store.touch({ path: "/work/a", instanceId: "w1", branch: "feat/x" });
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].branch).toBe("feat/x");
  });

  it("sorts most-recent-first by the logical clock", async () => {
    const store = createFileRecentProjects({ filePath });
    await store.touch({ path: "/work/a", instanceId: "w1" });
    await store.touch({ path: "/work/b", instanceId: "w1" });
    await store.touch({ path: "/work/a", instanceId: "w1" }); // bump a
    const list = await store.list();
    expect(list.map((p) => p.path)).toEqual(["/work/a", "/work/b"]);
  });

  it("preserves entries owned by other instances on write", async () => {
    const store = createFileRecentProjects({ filePath });
    await store.touch({ path: "/work/a", instanceId: "w1" });
    await store.touch({ path: "/work/b", instanceId: "w2" });
    const list = await store.list();
    expect(list.map((p) => p.instanceId).sort()).toEqual(["w1", "w2"]);
  });

  it("survives concurrent writers without corrupting the file (atomic write)", async () => {
    // Two stores point at the same machine-wide file (= two instances).
    const w1 = createFileRecentProjects({ filePath });
    const w2 = createFileRecentProjects({ filePath });
    await Promise.all([
      w1.touch({ path: "/work/a", instanceId: "w1" }),
      w2.touch({ path: "/work/b", instanceId: "w2" }),
      w1.touch({ path: "/work/c", instanceId: "w1" }),
      w2.touch({ path: "/work/d", instanceId: "w2" }),
    ]);
    // The file is always valid JSON (never a half-written read).
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.projects)).toBe(true);
    // No stray .tmp files left behind.
    const leftovers = readdirSync(join(dir, "nested")).filter((f) => f.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("release marks an instance's entries inactive", async () => {
    const store = createFileRecentProjects({ filePath });
    await store.touch({ path: "/work/a", instanceId: "w1" });
    await store.touch({ path: "/work/b", instanceId: "w2" });
    const cleared = await store.release("w1");
    expect(cleared).toBe(1);
    const list = await store.list();
    expect(list.find((p) => p.instanceId === "w1")?.active).toBe(false);
    expect(list.find((p) => p.instanceId === "w2")?.active).toBe(true);
  });

  it("recovers from a corrupt file instead of crashing", async () => {
    const store = createFileRecentProjects({ filePath });
    await store.touch({ path: "/work/a", instanceId: "w1" });
    // Corrupt it.
    const { writeFileSync } = await import("node:fs");
    writeFileSync(filePath, "{ not json", "utf8");
    expect(await store.list()).toEqual([]);
    // Next write heals it.
    await store.touch({ path: "/work/b", instanceId: "w1" });
    expect((await store.list()).map((p) => p.path)).toEqual(["/work/b"]);
  });
});
