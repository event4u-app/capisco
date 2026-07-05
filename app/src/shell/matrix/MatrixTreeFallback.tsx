import type { Session } from "@/contracts";

/**
 * Degradation view (P0): above the node budget the graph is replaced by a plain
 * session/subagent tree — same data, cheaper render — so a 200-session spawn
 * stays responsive (roadmap degradation clause).
 */
export function MatrixTreeFallback({ sessions }: { sessions: Session[] }) {
  return (
    <div className="matrix-tree" data-testid="matrix-tree-fallback" role="tree">
      <ul>
        {sessions.map((s) => (
          <li key={s.id} role="treeitem" data-testid={`matrix-tree-${s.id}`}>
            <span className="matrix-tree-node" data-status={s.status}>
              <span className="matrix-tree-dot" data-status={s.status} aria-hidden />
              <span className="matrix-tree-label">{s.title}</span>
              <span className="matrix-tree-model">{s.model}</span>
            </span>
            {s.subs && s.subs.length > 0 && (
              <ul role="group">
                {s.subs.map((sub) => (
                  <li key={sub.id} role="treeitem" data-testid={`matrix-tree-${sub.id}`}>
                    <span className="matrix-tree-node matrix-tree-sub" data-status={sub.status}>
                      <span className="matrix-tree-dot" data-status={sub.status} aria-hidden />
                      <span className="matrix-tree-label">{sub.title}</span>
                      <span className="matrix-tree-model">{sub.model}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
