import * as React from "react";
import { useTranslation } from "react-i18next";

import type { AgentProvider, Session } from "@/contracts";
import { mockAgentProvider } from "@/mocks";
import { countNodes, layoutGraph } from "./graph-layout";
import { MatrixGraphView } from "./MatrixGraphView";
import { MatrixTreeFallback } from "./MatrixTreeFallback";

export interface MatrixWorkspaceProps {
  /** Session stream source — the deterministic mock in the browser/test path. */
  provider?: AgentProvider;
  /** Above this node count the graph degrades to the tree view (roadmap clause). */
  nodeLimit?: number;
}

/**
 * Agent-Matrix v1 (road-to-agent-matrix-and-ambient P0) — the "brain": a
 * READ-ONLY projection of the live session/subagent stream. Sessions are nodes,
 * subagents child nodes, edges the parent relationship; each node shows status,
 * model, and live output tokens.
 *
 * Null-cost invariant (mechanism, not one-time proof): the Matrix mounts only
 * when its mode is selected and subscribes per session on mount; every
 * unsubscribe handle is released on unmount (subscribe-on-show /
 * unsubscribe-on-hide). The frontend leak test asserts the release path fires.
 * (The sidecar-side subscription counter + CI leak-test is Class-B, deferred to
 * the real-runtime track — the broker-ticker and process/container bar likewise
 * wait on their own frontend contracts, so this v1 shows the session graph only,
 * never a placeholder implying live broker/process data.)
 */
export function MatrixWorkspace({
  provider = mockAgentProvider,
  nodeLimit = 150,
}: MatrixWorkspaceProps) {
  const { t } = useTranslation();
  const [sessions, setSessions] = React.useState<Session[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const unsubs: (() => void)[] = [];
    void provider.listSessions().then((list) => {
      if (cancelled) return;
      setSessions(list);
      // Subscribe-on-show: one stream per session. A `telemetry` event refreshes
      // that session's live token counters (settles to a deterministic value).
      for (const s of list) {
        unsubs.push(
          provider.subscribe(s.id, (event) => {
            if (event.type !== "telemetry") return;
            setSessions((prev) =>
              prev.map((p) => (p.id === s.id ? { ...p, telemetry: event.telemetry } : p)),
            );
          }),
        );
      }
    });
    // Unsubscribe-on-hide: release every handle when the Matrix unmounts.
    return () => {
      cancelled = true;
      for (const u of unsubs) u();
    };
  }, [provider]);

  const graph = React.useMemo(() => layoutGraph(sessions), [sessions]);
  const total = countNodes(sessions);

  return (
    <div data-testid="matrix-workspace" data-mode="matrix" className="matrix-workspace">
      <div className="matrix-header">
        <span className="matrix-title">{t("matrix.title")}</span>
        <span className="matrix-count" data-testid="matrix-count">
          {t("matrix.sessionCount", { count: sessions.length })}
        </span>
      </div>
      {sessions.length === 0 ? (
        <div className="matrix-empty" data-testid="matrix-empty">
          {t("matrix.empty")}
        </div>
      ) : total > nodeLimit ? (
        <MatrixTreeFallback sessions={sessions} />
      ) : (
        <MatrixGraphView graph={graph} />
      )}
    </div>
  );
}
