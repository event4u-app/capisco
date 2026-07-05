/**
 * Agent-Matrix graph model (road-to-agent-matrix-and-ambient P0). The Matrix is
 * a READ-ONLY projection of the existing session/subagent stream — these types
 * are the projected shape the SVG view renders. Positions come from the PURE
 * `layoutGraph` function (index-based, never DOM-measured) so the render is
 * deterministic and golden-stable.
 */

import type { ModelId, SessionStatus } from "@/contracts";

export interface MatrixNode {
  id: string;
  /** Parent session id, or null for a root session node. */
  parentId: string | null;
  /** Display label (session/subagent title). */
  label: string;
  model: ModelId;
  status: SessionStatus;
  /** Output tokens (drives the threshold lamp). Deterministic from the mock. */
  tokensOut: number;
  /** Layout geometry (px) — from `layoutGraph`, never measured. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MatrixEdge {
  fromId: string;
  toId: string;
}

export interface MatrixGraph {
  nodes: MatrixNode[];
  edges: MatrixEdge[];
  /** SVG canvas extent (px). */
  width: number;
  height: number;
}
