/**
 * Matrix layout (P0) — the pure, deterministic core. These tests pin the
 * determinism the goldens rely on: identical input → identical geometry, with
 * positions from array index only (no DOM measurement, no physics).
 */

import { describe, expect, it } from "vitest";
import type { Session } from "@/contracts";
import { countNodes, layoutGraph, NODE_W } from "./graph-layout.ts";

const tel = { tokensIn: 0, tokensOut: 0, runtimeMs: 0 };

const sessions: Session[] = [
  {
    id: "s1",
    model: "Opus 4.8",
    status: "running",
    title: "Alpha",
    telemetry: { ...tel, tokensOut: 12_000 },
    subs: [
      { id: "s1a", model: "Haiku 4.8", status: "done", title: "sub a", telemetry: tel },
      { id: "s1b", model: "Haiku 4.8", status: "idle", title: "sub b", telemetry: tel },
    ],
  },
  { id: "s2", model: "Sonnet 4.6", status: "idle", title: "Beta", telemetry: tel },
];

describe("countNodes", () => {
  it("counts sessions plus all subagents", () => {
    expect(countNodes(sessions)).toBe(4); // 2 sessions + 2 subs
    expect(countNodes([])).toBe(0);
  });
});

describe("layoutGraph", () => {
  it("places sessions in column 0 and subagents in column 1", () => {
    const g = layoutGraph(sessions);
    const s1 = g.nodes.find((n) => n.id === "s1")!;
    const s1a = g.nodes.find((n) => n.id === "s1a")!;
    expect(s1.parentId).toBeNull();
    expect(s1.x).toBe(s2col0(g));
    expect(s1a.parentId).toBe("s1");
    expect(s1a.x).toBeGreaterThan(s1.x + NODE_W); // to the right of the session column
  });

  it("emits one edge per session→subagent pair", () => {
    const g = layoutGraph(sessions);
    expect(g.edges).toEqual([
      { fromId: "s1", toId: "s1a" },
      { fromId: "s1", toId: "s1b" },
    ]);
  });

  it("stacks nodes with strictly increasing y (no overlap between sessions)", () => {
    const g = layoutGraph(sessions);
    const s1 = g.nodes.find((n) => n.id === "s1")!;
    const s2 = g.nodes.find((n) => n.id === "s2")!;
    // s2 sits below s1's subagent stack, not overlapping it.
    expect(s2.y).toBeGreaterThan(s1.y + s1.height);
  });

  it("carries the session's output tokens onto the node", () => {
    const g = layoutGraph(sessions);
    expect(g.nodes.find((n) => n.id === "s1")!.tokensOut).toBe(12_000);
  });

  it("is deterministic — identical input yields byte-identical geometry", () => {
    expect(layoutGraph(sessions)).toEqual(layoutGraph(sessions));
  });

  it("returns a non-degenerate canvas for an empty session list", () => {
    const g = layoutGraph([]);
    expect(g.nodes).toEqual([]);
    expect(g.width).toBeGreaterThan(0);
    expect(g.height).toBeGreaterThan(0);
  });
});

function s2col0(g: ReturnType<typeof layoutGraph>): number {
  return g.nodes.find((n) => n.parentId === null)!.x;
}
