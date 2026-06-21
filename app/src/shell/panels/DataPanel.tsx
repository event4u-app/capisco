import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Database,
  DatabaseZap,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import type { Datasource } from "@/contracts";
import { mockDatasources } from "@/mocks";
import { PanelHead, PanelHeadAction } from "./PanelHead";

/** Env colour role (token roles, no hardcoded hex). */
function envColorClass(env: Datasource["env"]): string {
  switch (env) {
    case "production":
      return "text-warning";
    case "staging":
      return "text-primary";
    case "local":
      return "text-muted-foreground";
  }
}

/**
 * Data panel (build-spec §3 / §4.6) — datasource explorer GROUPED BY connection.
 *
 * Two invariants are rendered as UI FACTS, never as toggles (Overview §2):
 *  - `production` is READ-ONLY for all principals → a `READ-ONLY` badge on the
 *    connection + a lock glyph on every prod table. There is deliberately NO
 *    write toggle and no "allow permanently" affordance.
 *  - Secrets never appear as values → the credential is shown only as a
 *    reference name (`credential: prod-readonly`).
 */
export function DataPanel() {
  const { t } = useTranslation();
  // Production starts collapsed (matches the prototype: env !== production open).
  const [collapsed, setCollapsed] = React.useState<Set<string>>(
    () => new Set(mockDatasources.filter((d) => d.env === "production").map((d) => d.name)),
  );

  const toggle = (name: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const empty = mockDatasources.length === 0;

  return (
    <div data-testid="data-panel" className="flex h-full min-h-0 flex-col">
      <PanelHead title={t("data.head")}>
        <PanelHeadAction icon={Plus} label={t("data.newConnection")} />
        <PanelHeadAction icon={RefreshCw} label={t("data.refresh")} />
      </PanelHead>
      {empty ? (
        <p data-testid="data-empty" className="px-3 py-2 text-micro text-muted-foreground">
          {t("data.empty")}
        </p>
      ) : (
        <div
          data-testid="data-tree"
          role="tree"
          aria-label={t("data.label")}
          className="min-h-0 flex-1 select-none overflow-auto text-ui"
        >
          {mockDatasources.map((ds) => (
            <DataConn key={ds.name} ds={ds} open={!collapsed.has(ds.name)} onToggle={() => toggle(ds.name)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DataConn({ ds, open, onToggle }: { ds: Datasource; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="group">
      <button
        type="button"
        data-testid={`data-conn-${ds.name}`}
        role="treeitem"
        aria-expanded={open}
        onClick={onToggle}
        className="flex h-[26px] w-full cursor-pointer items-center gap-1.5 px-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn("size-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
          strokeWidth={1.8}
          aria-hidden
        />
        <Icon
          icon={ds.engine === "redis" ? DatabaseZap : Database}
          size={14}
          className={cn("shrink-0", envColorClass(ds.env))}
        />
        <span className="truncate font-medium text-foreground">{ds.name}</span>
        <span className="truncate font-mono text-[10.5px] text-muted-foreground">{ds.engine}</span>
        {ds.readonly && (
          <span
            data-testid={`data-readonly-${ds.name}`}
            className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-wide text-warning"
          >
            <Icon icon={Lock} size={10} className="text-warning" />
            {t("data.readonly")}
          </span>
        )}
      </button>

      {open && (
        <>
          {ds.credentialRef && (
            <div
              data-testid={`data-credential-${ds.name}`}
              className="flex h-[22px] items-center gap-1.5 pl-[30px] pr-2 font-mono text-micro text-muted-foreground"
            >
              <Icon icon={KeyRound} size={11} className="shrink-0 text-muted-foreground" />
              {/* Secret shown ONLY as a reference name — never the value (invariant §2.1). */}
              {t("data.credential", { ref: ds.credentialRef })}
            </div>
          )}
          {ds.tables.map((table) => (
            <div
              key={table}
              role="treeitem"
              data-testid={`data-table-${ds.name}-${table}`}
              className="flex h-[26px] items-center gap-1.5 pl-[30px] pr-2 hover:bg-accent"
            >
              <Icon icon={Table2} size={14} className="shrink-0 text-muted-foreground" />
              <span className="truncate text-foreground">{table}</span>
              {ds.readonly && (
                // Lock glyph carries the read-only meaning on each prod table.
                <span className="ml-auto shrink-0" role="img" aria-label={t("data.readonly")}>
                  <Icon icon={Lock} size={11} className="text-muted-foreground" />
                </span>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
