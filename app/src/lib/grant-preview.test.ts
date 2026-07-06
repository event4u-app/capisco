import { describe, expect, it } from "vitest";
import { buildGrantPreview, isUnderPrefix, suggestPathPrefix } from "./grant-preview";
import { mockPendingWrites } from "@/mocks/scoped-grant";
import type { PendingWriteIntent } from "@/contracts";

const w = (canonicalTarget: string): PendingWriteIntent => ({
  taskId: "t1",
  relTarget: canonicalTarget.replace("/repo/", ""),
  canonicalTarget,
});

describe("isUnderPrefix", () => {
  it("covers the prefix itself and strict descendants", () => {
    expect(isUnderPrefix("/repo/src/a.ts", "/repo/src/")).toBe(true);
    expect(isUnderPrefix("/repo/src/deep/b.ts", "/repo/src/")).toBe(true);
    expect(isUnderPrefix("/repo/src", "/repo/src/")).toBe(true); // the dir itself
  });

  it("is boundary-anchored — a sibling prefix does not match", () => {
    expect(isUnderPrefix("/repo/srcX/a.ts", "/repo/src/")).toBe(false);
    expect(isUnderPrefix("/repo/config/a.json", "/repo/src/")).toBe(false);
  });

  it("an empty prefix matches nothing", () => {
    expect(isUnderPrefix("/repo/src/a.ts", "")).toBe(false);
  });
});

describe("suggestPathPrefix", () => {
  it("extends the common ancestor by the shared project sub-tree", () => {
    // All under /repo/src → suggests /repo/src/.
    const pending = [w("/repo/src/a.ts"), w("/repo/src/lib/b.ts"), w("/repo/src/ui/c.tsx")];
    expect(suggestPathPrefix(pending)).toBe("/repo/src/");
  });

  it("falls back to the common ancestor when sub-trees diverge", () => {
    const pending = [w("/repo/src/a.ts"), w("/repo/config/b.json")];
    expect(suggestPathPrefix(pending)).toBe("/repo/");
  });

  it("returns empty for an empty set", () => {
    expect(suggestPathPrefix([])).toBe("");
  });
});

describe("buildGrantPreview", () => {
  it("partitions the mock batch into covered (src/) and out-of-scope (config/)", () => {
    const preview = buildGrantPreview(mockPendingWrites, "/repo/src/");
    expect(preview.covered.map((c) => c.relTarget)).toEqual([
      "src/app.ts",
      "src/lib/util.ts",
      "src/ui/panel.tsx",
    ]);
    expect(preview.outOfScope.map((c) => c.relTarget)).toEqual(["config/app.json"]);
    // Budget suggestion = covered count.
    expect(preview.maxActions).toBe(3);
  });

  it("suggests a budget of at least 1 even when nothing is covered", () => {
    const preview = buildGrantPreview([w("/repo/config/x.json")], "/repo/src/");
    expect(preview.covered).toHaveLength(0);
    expect(preview.maxActions).toBe(1);
  });

  it("preview + suggested prefix agree — the suggested prefix covers the majority", () => {
    const prefix = suggestPathPrefix(mockPendingWrites);
    const preview = buildGrantPreview(mockPendingWrites, prefix);
    // The suggested prefix is /repo/ (src and config diverge) → covers all 4.
    expect(prefix).toBe("/repo/");
    expect(preview.covered).toHaveLength(4);
  });
});
