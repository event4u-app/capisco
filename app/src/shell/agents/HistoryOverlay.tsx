import * as React from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";

/**
 * Cmd+R searchable prompt-history overlay (composer-intelligence, P4 fast-follow).
 * A boot-hidden modal over the session's `promptLogs` (most-recent-first,
 * filter-as-you-type). Picking an entry FILLS the composer — never auto-sends
 * (same contract as ↑/↓ recall). Boot-invisible: only mounts when opened, so the
 * composer goldens are unaffected.
 */
export function HistoryOverlay({
  log,
  onPick,
  onClose,
}: {
  log: string[];
  onPick: (text: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState("");
  const [sel, setSel] = React.useState(0);

  const items = React.useMemo(() => {
    const recent = [...log].reverse(); // most-recent-first
    const q = query.trim().toLowerCase();
    return q ? recent.filter((p) => p.toLowerCase().includes(q)) : recent;
  }, [log, query]);

  // Keep the selection in range as the filtered list shrinks.
  const clampedSel = items.length === 0 ? 0 : Math.min(sel, items.length - 1);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = items[clampedSel];
      if (pick !== undefined) onPick(pick);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="history-scrim" data-testid="history-overlay" onMouseDown={onClose}>
      <div
        className="history-pop"
        role="dialog"
        aria-label={t("agents.composer.historyTitle")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="history-search-row">
          <Search size={13} strokeWidth={1.8} aria-hidden />
          <input
            autoFocus
            type="text"
            className="history-search"
            data-testid="history-search"
            placeholder={t("agents.composer.historySearch")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="history-list" role="listbox">
          {items.length === 0 ? (
            <div className="history-empty" data-testid="history-empty">
              {t("agents.composer.historyEmpty")}
            </div>
          ) : (
            items.map((p, i) => (
              <button
                type="button"
                key={i}
                role="option"
                aria-selected={i === clampedSel}
                className={"history-item" + (i === clampedSel ? " sel" : "")}
                data-testid={`history-item-${i}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(p);
                }}
              >
                {p}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
