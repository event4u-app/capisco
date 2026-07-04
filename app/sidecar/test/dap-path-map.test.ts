import { describe, expect, it } from "vitest";

import { deriveMountMap } from "../runtime/mount-map.ts";
import { DapPathMap, resolveXdebugClientHost } from "../runtime/dap-path-map.ts";

/**
 * road-to-real-runtime P1 — the DAP path-mapping Knackpunkt. Verifies DAP
 * CONSUMES the P0 MountMap (both directions) and the OS-dependent xdebug
 * client_host, pure + fixture-only (no container / adapter needed).
 */
describe("DapPathMap (consumes the P0 MountMap)", () => {
  const mount = deriveMountMap({
    localWorkspaceFolder: "/Users/me/proj",
    config: { workspaceFolder: "/app", mounts: ["source=/Users/me/cache,target=/cache,type=bind"] },
  });

  it("translates a host breakpoint path → the in-container debuggee path", () => {
    const map = new DapPathMap(mount);
    expect(map.toDebuggee("/Users/me/proj/src/Foo.php")).toBe("/app/src/Foo.php");
    // A nested bind wins by longest prefix.
    expect(map.toDebuggee("/Users/me/cache/x")).toBe("/cache/x");
  });

  it("translates a container stack-frame path → the host editor path", () => {
    const map = new DapPathMap(mount);
    expect(map.toEditor("/app/src/Foo.php")).toBe("/Users/me/proj/src/Foo.php");
  });

  it("passes through a path under no bind (volume / vendored) unchanged", () => {
    const map = new DapPathMap(mount);
    expect(map.toDebuggee("/var/elsewhere/x")).toBe("/var/elsewhere/x");
    expect(map.toEditor("/opt/vendor/y")).toBe("/opt/vendor/y");
  });

  it("a host-only session (null mount) is identity in both directions", () => {
    const map = new DapPathMap(null);
    expect(map.containerized).toBe(false);
    expect(map.toDebuggee("/Users/me/proj/src/Foo.php")).toBe("/Users/me/proj/src/Foo.php");
    expect(map.toEditor("/Users/me/proj/src/Foo.php")).toBe("/Users/me/proj/src/Foo.php");
  });
});

describe("resolveXdebugClientHost (OS-dependent DBGp callback address)", () => {
  it("uses host.docker.internal on Docker Desktop (macOS / Windows)", () => {
    expect(resolveXdebugClientHost("darwin")).toBe("host.docker.internal");
    expect(resolveXdebugClientHost("win32")).toBe("host.docker.internal");
  });

  it("uses the docker bridge gateway on Linux (default docker0, or injected)", () => {
    expect(resolveXdebugClientHost("linux")).toBe("172.17.0.1");
    expect(resolveXdebugClientHost("linux", { linuxGateway: "10.0.0.1" })).toBe("10.0.0.1");
  });
});
