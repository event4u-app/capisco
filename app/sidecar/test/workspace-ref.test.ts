import { mkdtempSync, rmSync, symlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { canonicalPath, sameWorkspace, workspaceRef } from "../workspace/workspace-ref.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "capisco-wsref-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("canonicalPath / workspaceRef", () => {
  it("resolves a symlink to the same key as its target (one identity)", () => {
    const real = join(dir, "worktree");
    mkdirSync(real);
    const link = join(dir, "link-to-worktree");
    symlinkSync(real, link);

    expect(canonicalPath(link)).toBe(canonicalPath(real));
    expect(sameWorkspace(link, real)).toBe(true);
  });

  it("falls back to resolve for a path not on disk (pruned worktree)", () => {
    const gone = join(dir, "pruned", "worktree");
    // Not created — canonicalPath must not throw, just resolve it.
    expect(canonicalPath(gone)).toBe(gone);
  });

  it("workspaceRef carries the canonical key + attached roots", () => {
    const wt = join(dir, "wt");
    mkdirSync(wt);
    const ref = workspaceRef(wt, { containerRoot: "/var/www/html", lspRoot: wt, dapRoot: "/var/www/html" });
    expect(ref.worktreePath).toBe(wt);
    expect(ref.key).toBe(canonicalPath(wt));
    expect(ref.containerRoot).toBe("/var/www/html");
    expect(ref.lspRoot).toBe(wt);
    expect(ref.dapRoot).toBe("/var/www/html");
  });

  it("two spellings of the same checkout collapse to one key", () => {
    const real = join(dir, "repo");
    mkdirSync(real);
    const link = join(dir, "repo-alias");
    symlinkSync(real, link);
    expect(workspaceRef(link).key).toBe(workspaceRef(real).key);
  });
});
