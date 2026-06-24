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

/** Env colour role (prototype: prod = warning, staging = accent, local = muted). */
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
 * Data panel — 1:1 port of the prototype datasource explorer (`.ds-conn` /
 * `.ds-name` / `.ds-engine` / `.ds-ro`). Two invariants stay rendered as UI
 * FACTS (Overview §2): production is READ-ONLY (badge + lock glyphs, no toggle);
 * secrets show only as a reference name. Data/logic/testids preserved.
 */
export function DataPanel() {
  const { t } = useTranslation();
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
    <div data-testid="data-panel" className="explorer">
      <PanelHead title={t("data.head")}>
        <PanelHeadAction icon={Plus} label={t("data.newConnection")} />
        <PanelHeadAction icon={RefreshCw} label={t("data.refresh")} />
      </PanelHead>
      {empty ? (
        <p data-testid="data-empty" className="px-3 py-2 text-micro text-muted-foreground">
          {t("data.empty")}
        </p>
      ) : (
        <div data-testid="data-tree" role="tree" aria-label={t("data.label")} className="tree">
          {mockDatasources.map((ds) => (
            <DataConn
              key={ds.name}
              ds={ds}
              open={!collapsed.has(ds.name)}
              onToggle={() => toggle(ds.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DataConn({
  ds,
  open,
  onToggle,
}: {
  ds: Datasource;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div role="group">
      <button
        type="button"
        data-testid={`data-conn-${ds.name}`}
        role="treeitem"
        aria-expanded={open}
        onClick={onToggle}
        className="ds-conn w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="tr-chevron">
          <ChevronRight
            className={cn("size-3 transition-transform", open && "rotate-90")}
            strokeWidth={2}
            aria-hidden
          />
        </span>
        <Icon
          icon={ds.engine === "redis" ? DatabaseZap : Database}
          size={14}
          className={cn("shrink-0", envColorClass(ds.env))}
        />
        <span className="ds-name">{ds.name}</span>
        <span className="ds-engine">{ds.engine}</span>
        {ds.readonly && (
          <span data-testid={`data-readonly-${ds.name}`} className="ds-ro">
            <Icon icon={Lock} size={10} />
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
              {t("data.credential", { ref: ds.credentialRef })}
            </div>
          )}
          {ds.tables.map((table) => (
            <div
              key={table}
              role="treeitem"
              data-testid={`data-table-${ds.name}-${table}`}
              className="tr-row"
              style={{ paddingLeft: 30 }}
            >
              <Icon icon={Table2} size={14} className="shrink-0 text-muted-foreground" />
              <span className="tr-label">{table}</span>
              {ds.readonly && (
                <span className="tr-trailing" role="img" aria-label={t("data.readonly")}>
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
