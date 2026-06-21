import { useTranslation } from "react-i18next";
import { ArrowDownUp, ListCollapse } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SymbolKind, SymbolNode } from "@/contracts";
import { mockStructure } from "@/mocks";
import { useEditor } from "@/shell/editor/store";
import { PanelHead, PanelHeadAction } from "./PanelHead";

// Kind → token-driven badge tint. No hardcoded hex (CSS vars / Tailwind tokens).
const KIND_CLASS: Record<SymbolKind, string> = {
  C: "bg-primary/20 text-primary",
  m: "bg-warning/20 text-warning",
  p: "bg-muted text-muted-foreground",
  I: "bg-success/20 text-success",
  E: "bg-destructive/20 text-destructive",
};

/**
 * Structure panel (build-spec §3) — symbol outline of the ACTIVE editor file
 * with kind badges (class / method / property / interface / enum). Tracks the
 * editor store's active file; honest empty state when no symbols are known.
 */
export function StructurePanel() {
  const { t } = useTranslation();
  const activeFile = useEditor((s) => s.activeFile);
  const base = activeFile.split("/").pop() ?? activeFile;
  const symbols = mockStructure(activeFile);

  return (
    <div data-testid="structure-panel" className="flex h-full min-h-0 flex-col">
      <PanelHead title={`${t("structure.head")} · ${base}`}>
        <PanelHeadAction icon={ArrowDownUp} label={t("structure.sort")} />
        <PanelHeadAction icon={ListCollapse} label={t("structure.collapseAll")} />
      </PanelHead>
      <div role="tree" aria-label={t("structure.label")} className="min-h-0 flex-1 overflow-auto py-1">
        {symbols.length === 0 ? (
          <p className="px-3 py-2 text-micro text-muted-foreground">{t("structure.empty")}</p>
        ) : (
          symbols.map((sym, i) => <SymbolRow key={`${sym.name}/${i}`} sym={sym} />)
        )}
      </div>
    </div>
  );
}

function SymbolRow({ sym }: { sym: SymbolNode }) {
  const { t } = useTranslation();
  return (
    <div
      role="treeitem"
      aria-level={sym.depth + 1}
      data-testid={`structure-symbol-${sym.name}`}
      style={{ paddingLeft: 8 + sym.depth * 14 }}
      className="flex h-[24px] items-center gap-2 pr-2 text-ui hover:bg-accent"
    >
      <span
        title={t(`structure.kind.${sym.kind}`)}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-sm font-mono text-[10px] font-semibold",
          KIND_CLASS[sym.kind],
        )}
      >
        {sym.kind}
      </span>
      <span className="truncate font-mono text-code text-foreground">{sym.name}</span>
    </div>
  );
}
