import * as React from "react";
import { useTranslation } from "react-i18next";

import type { ProcessHealth, ProcessState, SupervisorProvider } from "@/contracts";
import { mockSupervisorProvider } from "@/mocks";

/** Process state → design-system colour (mirrors the container/session dots). */
const STATE_COLOR: Record<ProcessState, string> = {
  running: "var(--ds-success)",
  starting: "var(--ds-accent)",
  restarting: "var(--ds-warning)",
  exited: "var(--ds-text-tertiary)",
  killed: "var(--ds-error)",
};

/**
 * Process-health strip (agent-matrix P0 — the process half of the
 * process/container bar; completes the ctop-UI slice). Read-only projection of
 * the sidecar `ProcessSupervisor` health snapshot: one row per supervised
 * process (state dot · id · pid · restarts), with restart counts marked.
 *
 * Null-cost: seeds from `health()` and subscribes on mount; releases the
 * subscription on unmount. Sorted by id → deterministic (golden-stable). Carries
 * no command/output/secret — the contract only exposes lifecycle facts.
 */
export function ProcessStrip({
  provider = mockSupervisorProvider,
}: {
  provider?: SupervisorProvider;
}) {
  const { t } = useTranslation();
  const [procs, setProcs] = React.useState<ProcessHealth[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void provider.health().then((h) => {
      if (!cancelled) setProcs(h);
    });
    const unsub = provider.subscribe((h) => setProcs(h));
    return () => {
      cancelled = true;
      unsub(); // unsubscribe-on-hide — no leaked subscription
    };
  }, [provider]);

  if (procs.length === 0) {
    return null;
  }
  const sorted = [...procs].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="matrix-procs" data-testid="process-strip">
      <div className="matrix-broker-head">
        <span className="matrix-broker-title">{t("matrix.processes.title")}</span>
        <span className="matrix-broker-count" data-testid="process-count">
          {sorted.length}
        </span>
      </div>
      <div className="ctr-rows">
        {sorted.map((p) => (
          <div
            className="ctr-row"
            key={p.id}
            data-testid={`process-${p.id}`}
            data-state={p.state}
          >
            <span
              className="ctr-dot"
              style={{ background: STATE_COLOR[p.state] }}
              aria-hidden
            />
            <span className="ctr-name">{p.id}</span>
            <span className="ctr-image">{p.state}</span>
            <span className="proc-pid">{p.pid !== undefined ? `pid ${p.pid}` : "—"}</span>
            {p.restarts > 0 && (
              <span
                className="proc-restarts"
                data-testid={`process-restarts-${p.id}`}
                title={t("matrix.processes.restarts", { count: p.restarts })}
              >
                ↺ {p.restarts}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
