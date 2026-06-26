import { describe, expect, it } from "vitest";

import { BackendSelection, costUsd, type BackendDetector } from "../acp/backend-selection.ts";
import type { AgentBackend } from "@/contracts";

const CATALOG: AgentBackend[] = [
  { id: "claude-native", label: "Claude Code (native)", driver: "native-stream-json", status: "ready", detail: "/opt/homebrew/bin/claude", version: "2.1.191" },
  { id: "claude-code-acp", label: "Claude Code (via ACP)", driver: "acp-bridge", status: "installable", installCommand: ["npm", "i", "-g", "@zed-industries/claude-code-acp"] },
  { id: "node", label: "Node.js", driver: "prerequisite", status: "ready", detail: "/usr/bin/node" },
];

function detector(catalog = CATALOG): BackendDetector {
  return { detect: () => Promise.resolve(catalog) };
}

describe("costUsd", () => {
  it("computes USD from token telemetry by model", () => {
    // opus: 15/Mtok in, 75/Mtok out. 1M in + 1M out = 15 + 75 = $90.
    expect(costUsd("claude-opus-4-8", { tokensIn: 1_000_000, tokensOut: 1_000_000, runtimeMs: 0 })).toBeCloseTo(90);
  });
  it("falls back to family pricing for an unlisted point-release", () => {
    expect(costUsd("claude-sonnet-4-7-20991231", { tokensIn: 1_000_000, tokensOut: 0, runtimeMs: 0 })).toBeCloseTo(3);
  });
  it("returns 0 (honest) for an unknown model family", () => {
    expect(costUsd("some-unknown-llm", { tokensIn: 1_000_000, tokensOut: 1_000_000, runtimeMs: 0 })).toBe(0);
  });
});

describe("BackendSelection", () => {
  it("detect() returns the real catalog and defaults to the first ready backend", async () => {
    const sel = new BackendSelection(detector());
    const list = await sel.detect();
    expect(list).toHaveLength(3);
    expect(sel.selectedId()).toBe("claude-native"); // first ready
  });

  it("current() reports the REAL selected backend label, not 'API'", async () => {
    const sel = new BackendSelection(detector());
    await sel.detect();
    const cfg = sel.current();
    expect(cfg.kind).toBe("cli");
    expect(cfg.provider).toBe("Claude Code (native) 2.1.191");
    expect(cfg.provider).not.toMatch(/^API$/);
  });

  it("select() switches the active backend", async () => {
    const ready: AgentBackend[] = [
      CATALOG[0],
      { ...CATALOG[1], status: "ready", detail: "/usr/local/bin/claude-code-acp" },
    ];
    const sel = new BackendSelection(detector(ready));
    await sel.detect();
    sel.select("claude-code-acp");
    expect(sel.selectedId()).toBe("claude-code-acp");
    expect(sel.current().provider).toBe("Claude Code (via ACP)");
    expect(sel.runConfig()).toEqual({ driver: "acp-bridge", command: "/usr/local/bin/claude-code-acp", args: [] });
  });

  it("select() refuses a non-ready (installable) backend", async () => {
    const sel = new BackendSelection(detector());
    await sel.detect();
    expect(() => sel.select("claude-code-acp")).toThrow(/not ready|installable/i);
  });

  it("select() refuses an unknown id", async () => {
    const sel = new BackendSelection(detector());
    await sel.detect();
    expect(() => sel.select("nope")).toThrow(/unknown backend/i);
  });

  it("runConfig() for the native backend names the native driver (no acp command)", async () => {
    const sel = new BackendSelection(detector());
    await sel.detect();
    expect(sel.runConfig()).toEqual({ driver: "native-stream-json" });
  });

  it("cost() computes from the active model + telemetry", async () => {
    const sel = new BackendSelection(detector());
    await sel.detect();
    expect(sel.cost("claude-haiku-4-5", { tokensIn: 1_000_000, tokensOut: 0, runtimeMs: 0 })).toBeCloseTo(0.8);
  });
});
