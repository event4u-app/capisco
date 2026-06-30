/**
 * Host↔container mount mapping (road-to-real-runtime P0, Council-Trap). Pure +
 * fixture-driven — no container, no daemon, no fs. Proves the data structure
 * DAP (P1) consumes: derive a MountMap from a worktree's devcontainer mount
 * config and translate paths both ways by longest-prefix bind match.
 */

import { describe, expect, it } from "vitest";

import { MountMap, deriveMountMap, parseMountString } from "../runtime/mount-map.ts";

describe("parseMountString", () => {
  it("parses source/target/type and the common aliases", () => {
    expect(parseMountString("source=/h,target=/c,type=bind")).toEqual({
      source: "/h",
      target: "/c",
      type: "bind",
    });
    expect(parseMountString("src=/h,dst=/c")).toEqual({ source: "/h", target: "/c" });
    expect(parseMountString("destination=/c,source=/h")).toEqual({ source: "/h", target: "/c" });
  });
  it("ignores empty values and unknown keys", () => {
    expect(parseMountString("source=,target=/c,readonly=true")).toEqual({ target: "/c" });
  });
});

describe("deriveMountMap — default workspace bind", () => {
  it("binds the local folder to /workspaces/<basename> when no config", () => {
    const map = deriveMountMap({ localWorkspaceFolder: "/Users/me/repo" });
    expect(map.workspaceEntry()).toEqual({
      hostPath: "/Users/me/repo",
      containerPath: "/workspaces/repo",
    });
  });

  it("translates a nested file host→container and back", () => {
    const map = deriveMountMap({ localWorkspaceFolder: "/Users/me/repo" });
    expect(map.toContainer("/Users/me/repo/src/x.ts")).toBe("/workspaces/repo/src/x.ts");
    expect(map.toHost("/workspaces/repo/src/x.ts")).toBe("/Users/me/repo/src/x.ts");
  });

  it("maps the root path itself (no relative remainder)", () => {
    const map = deriveMountMap({ localWorkspaceFolder: "/Users/me/repo" });
    expect(map.toContainer("/Users/me/repo")).toBe("/workspaces/repo");
    expect(map.toHost("/workspaces/repo")).toBe("/Users/me/repo");
  });

  it("returns undefined for a path under no mount", () => {
    const map = deriveMountMap({ localWorkspaceFolder: "/Users/me/repo" });
    expect(map.toContainer("/etc/passwd")).toBeUndefined();
    expect(map.toHost("/var/lib/other")).toBeUndefined();
  });
});

describe("deriveMountMap — explicit workspaceFolder / workspaceMount", () => {
  it("honours an explicit workspaceFolder container path", () => {
    const map = deriveMountMap({
      localWorkspaceFolder: "/Users/me/repo",
      config: { workspaceFolder: "/app" },
    });
    expect(map.toContainer("/Users/me/repo/a.ts")).toBe("/app/a.ts");
  });

  it("honours an explicit workspaceMount with ${localWorkspaceFolder} substitution", () => {
    const map = deriveMountMap({
      localWorkspaceFolder: "/Users/me/repo",
      config: {
        workspaceMount: "source=${localWorkspaceFolder},target=/srv/${localWorkspaceFolderBasename},type=bind",
      },
    });
    expect(map.workspaceEntry()).toEqual({
      hostPath: "/Users/me/repo",
      containerPath: "/srv/repo",
    });
    expect(map.toContainer("/Users/me/repo/src/y.ts")).toBe("/srv/repo/src/y.ts");
  });
});

describe("deriveMountMap — additional mounts", () => {
  it("adds a bind mount and skips a volume mount (no host twin)", () => {
    const map = deriveMountMap({
      localWorkspaceFolder: "/Users/me/repo",
      config: {
        mounts: [
          "source=/Users/me/cache,target=/cache,type=bind",
          "source=node_modules,target=/workspaces/repo/node_modules,type=volume",
        ],
      },
    });
    expect(map.entries()).toHaveLength(2); // workspace + the one bind
    expect(map.toContainer("/Users/me/cache/pkg")).toBe("/cache/pkg");
    expect(map.toHost("/cache/pkg")).toBe("/Users/me/cache/pkg");
    // The volume target has no host correspondence.
    expect(map.toHost("/workspaces/repo/node_modules/foo")).toBe(
      "/Users/me/repo/node_modules/foo", // falls under the WORKSPACE bind, not the volume
    );
  });

  it("accepts object-form mounts", () => {
    const map = deriveMountMap({
      localWorkspaceFolder: "/Users/me/repo",
      config: { mounts: [{ source: "/Users/me/data", target: "/data", type: "bind" }] },
    });
    expect(map.toContainer("/Users/me/data/db.sqlite")).toBe("/data/db.sqlite");
  });
});

describe("MountMap — longest-prefix (nested mounts) wins", () => {
  it("resolves a nested bind to its most specific mount", () => {
    const map = new MountMap([
      { hostPath: "/Users/me/repo", containerPath: "/workspaces/repo" },
      { hostPath: "/Users/me/repo/vendor", containerPath: "/opt/vendor" },
    ]);
    // A file under the nested vendor mount resolves to the nested target, not the parent.
    expect(map.toContainer("/Users/me/repo/vendor/lib.ts")).toBe("/opt/vendor/lib.ts");
    // A file outside vendor still resolves to the workspace mount.
    expect(map.toContainer("/Users/me/repo/src/a.ts")).toBe("/workspaces/repo/src/a.ts");
    // Reverse direction is symmetric.
    expect(map.toHost("/opt/vendor/lib.ts")).toBe("/Users/me/repo/vendor/lib.ts");
  });

  it("does not match a sibling-prefix path (boundary safety)", () => {
    const map = new MountMap([{ hostPath: "/Users/me/repo", containerPath: "/workspaces/repo" }]);
    // "/Users/me/repo-other" must NOT be treated as under "/Users/me/repo".
    expect(map.toContainer("/Users/me/repo-other/x.ts")).toBeUndefined();
  });
});
