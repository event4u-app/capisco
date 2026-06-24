import { useTranslation } from "react-i18next";
import { ArrowDownUp, ListCollapse } from "lucide-react";
import type { SymbolNode } from "@/contracts";
import { mockStructure } from "@/mocks";
import { useEditor } from "@/shell/editor/store";
import { PanelHead, PanelHeadAction } from "./PanelHead";

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
      <div role="tree" aria-label={t("structure.label")} className="tree">
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
      className="struct-row"
    >
      <span title={t(`structure.kind.${sym.kind}`)} className={`sym sym-${sym.kind}`}>
        {sym.kind}
      </span>
      <span className="struct-name">{sym.name}</span>
    </div>
  );
}
