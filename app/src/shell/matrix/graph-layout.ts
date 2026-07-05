/**
 * Pure, deterministic Matrix layout (P0). Sessions are placed in column 0;
 * their subagents in column 1, stacked under the session. Positions are a pure
 * function of array index + fixed constants — NO DOM measurement, NO physics,
 * NO `requestAnimationFrame`, NO `Date`/random — so the SVG render is
 * byte-stable for goldens and O(n) at any node count.
 */

import type { Session } from "@/contracts";
import type { MatrixGraph, MatrixNode } from "./graph-model";

export const NODE_W = 184;
export const NODE_H = 52;
export const COL_GAP = 64;
export const ROW_GAP = 16;
const PAD = 20;

/** Total node count (sessions + all subagents) — drives the fallback threshold. */
export function countNodes(sessions: Session[]): number {
  return sessions.reduce((n, s) => n + 1 + (s.subs?.length ?? 0), 0);
}

export function layoutGraph(sessions: Session[]): MatrixGraph {
  const nodes: MatrixNode[] = [];
  const edges: { fromId: string; toId: string }[] = [];
  const col0 = PAD;
  const col1 = PAD + NODE_W + COL_GAP;
  let y = PAD;
  let maxX = col0 + NODE_W;

  for (const s of sessions) {
    const subs = s.subs ?? [];
    nodes.push({
      id: s.id,
      parentId: null,
      label: s.title,
      model: s.model,
      status: s.status,
      tokensOut: s.telemetry.tokensOut,
      x: col0,
      y,
      width: NODE_W,
      height: NODE_H,
    });
    subs.forEach((sub, j) => {
      const subY = y + j * (NODE_H + ROW_GAP);
      nodes.push({
        id: sub.id,
        parentId: s.id,
        label: sub.title,
        model: sub.model,
        status: sub.status,
        tokensOut: sub.telemetry.tokensOut,
        x: col1,
        y: subY,
        width: NODE_W,
        height: NODE_H,
      });
      edges.push({ fromId: s.id, toId: sub.id });
      maxX = Math.max(maxX, col1 + NODE_W);
    });
    // Advance past the taller of the session row or its subagent stack.
    const stackH = subs.length ? subs.length * (NODE_H + ROW_GAP) - ROW_GAP : NODE_H;
    y += Math.max(NODE_H, stackH) + ROW_GAP * 2;
  }

  return {
    nodes,
    edges,
    width: maxX + PAD,
    height: Math.max(y - ROW_GAP + PAD, PAD + NODE_H + PAD),
  };
}
