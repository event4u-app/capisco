import * as React from "react";
import { useTranslation } from "react-i18next";
import { Bot, User } from "lucide-react";

import type { AuditEntry, AuditStore } from "@/contracts";
import { mockAuditStore } from "@/mocks";

/** Outcome → design-system tone (same palette as the broker permission block). */
const OUTCOME_TONE: Record<string, string> = {
  allow: "var(--ds-success)",
  executed: "var(--ds-accent)",
  ask: "var(--ds-warning)",
  deny: "var(--ds-error)",
  "vault-write-proposed": "var(--ds-accent)",
};

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function AuditRow({ entry }: { entry: AuditEntry }) {
  const Icon = entry.principalKind === "human" ? User : Bot;
  return (
    <div
      className="broker-row"
      data-testid={`broker-entry-${entry.seq}`}
      data-outcome={entry.outcome}
    >
      <Icon size={12} className="broker-actor" strokeWidth={2} aria-hidden />
      <span className="broker-cap">{entry.capability}</span>
      <span className="broker-target" title={entry.target}>
        {clip(entry.target, 40)}
      </span>
      {entry.credentialRef && (
        <span className="broker-cred" data-testid={`broker-cred-${entry.seq}`}>
          credential: {entry.credentialRef}
        </span>
      )}
      {entry.fromUntrusted && (
        <span className="broker-untrusted" title="from untrusted source">
          untrusted
        </span>
      )}
      <span
        className="broker-outcome"
        style={{ color: OUTCOME_TONE[entry.outcome] ?? "var(--ds-text-tertiary)" }}
      >
        {entry.outcome}
      </span>
    </div>
  );
}

/**
 * Broker-ticker + audit-viewer (agent-matrix P0; also pays down actually-works
 * P3's open audit-viewer). Read-only projection of the broker's append-only
 * decision stream: the last N decisions live, expandable to the full trail.
 *
 * Null-cost: seeds from `store.list()` and subscribes for live appends on mount;
 * releases the subscription on unmount (subscribe-on-show / unsubscribe-on-hide).
 * Secret-safe by construction — `AuditEntry` carries a `credentialRef` NAME and
 * has no value field, so a secret value can never be rendered.
 */
export function BrokerTicker({
  store = mockAuditStore,
  max = 5,
}: {
  store?: AuditStore;
  max?: number;
}) {
  const { t } = useTranslation();
  // Seed the most-recent-first snapshot once (lazy init — no synchronous
  // setState in the effect). `store`/`max` are stable props for the mounted
  // Matrix; the effect only wires the live-append subscription.
  const [recent, setRecent] = React.useState<AuditEntry[]>(() =>
    store.list().slice(-max).reverse(),
  );
  const [full, setFull] = React.useState<readonly AuditEntry[] | null>(null);

  React.useEffect(() => {
    const unsub = store.subscribe((e) => setRecent((prev) => [e, ...prev].slice(0, max)));
    return unsub; // unsubscribe-on-hide — no leaked subscription
  }, [store, max]);

  return (
    <div className="matrix-broker" data-testid="broker-ticker">
      <div className="matrix-broker-head">
        <span className="matrix-broker-title">{t("matrix.broker.title")}</span>
        <button
          type="button"
          className="matrix-broker-toggle"
          data-testid="broker-toggle"
          aria-expanded={full !== null}
          onClick={() => setFull((f) => (f === null ? store.list() : null))}
        >
          {full === null
            ? t("matrix.broker.viewAll", { count: store.list().length })
            : t("matrix.broker.collapse")}
        </button>
      </div>
      <div className="broker-rows">
        {recent.map((e) => (
          <AuditRow key={e.seq} entry={e} />
        ))}
      </div>
      {full !== null && (
        <div className="broker-full" data-testid="broker-audit-list" role="log">
          {full.map((e) => (
            <AuditRow key={e.seq} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}
