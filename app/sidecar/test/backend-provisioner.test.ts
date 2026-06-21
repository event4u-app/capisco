// @vitest-environment node
/**
 * Backend-detection test (B8 P0). Proves the provisioner builds the structured
 * `AgentBackend[]` catalog with the right per-backend status — hermetically,
 * against a FAKE host probe (no real `which`/spawn). Covers:
 *
 *  - all-present host → everything `ready`, claude-native + acp-bridge usable;
 *  - missing bridge but npm present → bridge `installable` with the exact
 *    `npm i -g @zed-industries/claude-code-acp` command;
 *  - missing bridge AND missing npm → bridge falls back to `guide` (no install
 *    command — install node/npm first);
 *  - missing claude → claude-native `guide` (never installable — it carries a
 *    login) + a guide URL;
 *  - optional codex/gemini surfaced only when asked.
 */

import { describe, expect, it } from "vitest";
import type { AgentBackend } from "@/contracts";
import {
  ACP_BRIDGE_INSTALL_COMMAND,
  RealBackendProvisioner,
  type HostProbe,
} from "../provision/backend-provisioner.ts";

/** A fake probe over a fixed install/version table — fully deterministic. */
function fakeProbe(present: Record<string, string>, versions: Record<string, string> = {}): HostProbe {
  return {
    resolve: (command) => present[command],
    version: (command) => Promise.resolve(versions[command]),
  };
}

function byId(list: AgentBackend[], id: string): AgentBackend {
  const found = list.find((b) => b.id === id);
  if (!found) throw new Error(`backend ${id} not in catalog`);
  return found;
}

describe("BackendProvisioner — read-only detection catalog", () => {
  it("marks everything ready when node/npm/npx/claude/bridge are all present", async () => {
    const probe = fakeProbe(
      {
        node: "/usr/bin/node",
        npm: "/usr/bin/npm",
        npx: "/usr/bin/npx",
        claude: "/usr/local/bin/claude",
        "claude-code-acp": "/usr/local/lib/node_modules/.bin/claude-code-acp",
      },
      { node: "v25.0.0", claude: "2.1.185 (Claude Code)", "claude-code-acp": "0.4.0" },
    );
    const catalog = await new RealBackendProvisioner({ probe }).detect();

    expect(byId(catalog, "node").status).toBe("ready");
    expect(byId(catalog, "node").version).toBe("v25.0.0");

    const native = byId(catalog, "claude-native");
    expect(native.status).toBe("ready");
    expect(native.driver).toBe("native-stream-json");
    expect(native.detail).toBe("/usr/local/bin/claude");
    expect(native.version).toContain("2.1.185");
    expect(native.installCommand).toBeUndefined();

    const acp = byId(catalog, "claude-code-acp");
    expect(acp.status).toBe("ready");
    expect(acp.driver).toBe("acp-bridge");
    expect(acp.installCommand).toBeUndefined();
  });

  it("marks the ACP bridge installable (exact npm command) when missing but npm is present", async () => {
    const probe = fakeProbe({
      node: "/usr/bin/node",
      npm: "/usr/bin/npm",
      npx: "/usr/bin/npx",
      claude: "/usr/local/bin/claude",
      // claude-code-acp absent.
    });
    const catalog = await new RealBackendProvisioner({ probe }).detect();
    const acp = byId(catalog, "claude-code-acp");
    expect(acp.status).toBe("installable");
    expect(acp.installCommand).toEqual([...ACP_BRIDGE_INSTALL_COMMAND]);
    expect(acp.installCommand).toEqual(["npm", "i", "-g", "@zed-industries/claude-code-acp"]);
    expect(acp.detail).toBeUndefined();
    // Never silently ready — it must be installed first.
    expect(acp.status).not.toBe("ready");
  });

  it("falls back to guide (no install command) when npm itself is missing", async () => {
    const probe = fakeProbe({
      node: "/usr/bin/node",
      claude: "/usr/local/bin/claude",
      // npm/npx and bridge all absent.
    });
    const catalog = await new RealBackendProvisioner({ probe }).detect();

    expect(byId(catalog, "npm").status).toBe("guide");
    expect(byId(catalog, "npm").guideUrl).toBeTruthy();

    const acp = byId(catalog, "claude-code-acp");
    expect(acp.status).toBe("guide");
    expect(acp.installCommand).toBeUndefined();
    expect(acp.guideUrl).toBeTruthy();
  });

  it("never offers to auto-install the claude CLI (login-bearing) — guide only", async () => {
    const probe = fakeProbe({ node: "/usr/bin/node", npm: "/usr/bin/npm", npx: "/usr/bin/npx" });
    const catalog = await new RealBackendProvisioner({ probe }).detect();
    const native = byId(catalog, "claude-native");
    expect(native.status).toBe("guide");
    expect(native.installCommand).toBeUndefined();
    expect(native.guideUrl).toBeTruthy();
  });

  it("surfaces optional codex/gemini only when asked", async () => {
    const base = fakeProbe({ node: "/usr/bin/node", npm: "/usr/bin/npm", npx: "/usr/bin/npx" });
    const without = await new RealBackendProvisioner({ probe: base }).detect();
    expect(without.find((b) => b.id === "codex")).toBeUndefined();

    const withOpt = await new RealBackendProvisioner({ probe: base, includeOptional: true }).detect();
    expect(byId(withOpt, "codex").status).toBe("guide");
    expect(byId(withOpt, "gemini").status).toBe("guide");

    const present = fakeProbe({
      node: "/usr/bin/node",
      npm: "/usr/bin/npm",
      npx: "/usr/bin/npx",
      codex: "/usr/local/bin/codex",
    });
    const withCodex = await new RealBackendProvisioner({ probe: present, includeOptional: true }).detect();
    expect(byId(withCodex, "codex").status).toBe("ready");
  });
});
