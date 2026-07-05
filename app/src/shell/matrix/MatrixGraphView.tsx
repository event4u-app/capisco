import type { SessionStatus } from "@/contracts";
import type { MatrixGraph, MatrixNode } from "./graph-model";

/** Status → design-system colour (the same palette the session dots use). */
const STATUS_COLOR: Record<SessionStatus, string> = {
  running: "var(--ds-accent)",
  waiting: "var(--ds-warning)",
  error: "var(--ds-error)",
  done: "var(--ds-success)",
  idle: "var(--ds-text-tertiary)",
};

/** Token threshold lamp (deterministic; USD cost is real-breadth P2, not here). */
function tokenTone(tokensOut: number): string {
  if (tokensOut >= 100_000) return "var(--ds-error)";
  if (tokensOut >= 50_000) return "var(--ds-warning)";
  return "var(--ds-success)";
}

const fmtK = (n: number) =>
  n >= 1000 ? (n / 1000).toFixed(n >= 10_000 ? 0 : 1) + "k" : String(n);

/** Deterministic label truncation (no DOM measurement). */
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function MatrixNodeEl({ node }: { node: MatrixNode }) {
  const isSub = node.parentId !== null;
  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      data-testid={`matrix-node-${node.id}`}
      data-status={node.status}
    >
      <rect
        width={node.width}
        height={node.height}
        rx={6}
        fill="var(--ds-bg-tool)"
        stroke={isSub ? "var(--ds-border)" : "var(--ds-border-strong)"}
        strokeWidth={1}
      />
      <circle cx={12} cy={14} r={4} fill={STATUS_COLOR[node.status]} />
      <text x={24} y={18} fill="var(--ds-text-primary)" fontSize={12} fontWeight={500}>
        {clip(node.label, isSub ? 20 : 22)}
      </text>
      <text x={12} y={38} fill="var(--ds-text-tertiary)" fontSize={10.5}>
        {clip(node.model, 16)}
      </text>
      <text
        x={node.width - 12}
        y={38}
        textAnchor="end"
        fill={tokenTone(node.tokensOut)}
        fontSize={10.5}
        fontWeight={600}
        data-testid={`matrix-tokens-${node.id}`}
      >
        {fmtK(node.tokensOut)}
      </text>
    </g>
  );
}

/**
 * The Matrix graph (P0): sessions as nodes, subagents as child nodes, edges =
 * parent relationship. Pure SVG — no external graph library (icons inline,
 * self-contained). Positions come from `layoutGraph` (deterministic), so the
 * render is golden-stable.
 */
export function MatrixGraphView({ graph }: { graph: MatrixGraph }) {
  return (
    <div className="matrix-graph-scroll" data-testid="matrix-graph-scroll">
      <svg
        data-testid="matrix-graph"
        width={graph.width}
        height={graph.height}
        role="img"
        aria-label="Agent session graph"
      >
        {graph.edges.map((e) => {
          const from = graph.nodes.find((n) => n.id === e.fromId);
          const to = graph.nodes.find((n) => n.id === e.toId);
          if (!from || !to) return null;
          return (
            <line
              key={`${e.fromId}-${e.toId}`}
              x1={from.x + from.width}
              y1={from.y + from.height / 2}
              x2={to.x}
              y2={to.y + to.height / 2}
              stroke="var(--ds-border-strong)"
              strokeWidth={1}
            />
          );
        })}
        {graph.nodes.map((n) => (
          <MatrixNodeEl key={n.id} node={n} />
        ))}
      </svg>
    </div>
  );
}
