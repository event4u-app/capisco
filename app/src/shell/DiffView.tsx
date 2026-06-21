import * as React from "react";
import { useTranslation } from "react-i18next";
import { FileCode2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { VirtualList } from "@/components/ui/virtual-list";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DiffDoc, DiffRow } from "@/contracts";
import { mockDiff } from "@/mocks";
import { useLayout } from "./store";

const ROW_HEIGHT = 20;

function SplitRow({ row }: { row: DiffRow }) {
  return (
    <div className="flex h-5 min-w-max font-mono text-code leading-5">
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 px-2",
          row.k === "del" && "bg-destructive/15",
          row.k === "add" && !row.l && "bg-muted/40",
        )}
      >
        {row.l ? (
          <>
            <span className="w-8 shrink-0 select-none text-right text-muted-foreground">{row.l.n}</span>
            <span className="whitespace-pre text-foreground">{row.l.t}</span>
          </>
        ) : (
          <span className="w-8 shrink-0" />
        )}
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 border-l border-border px-2",
          row.k === "add" && "bg-success/15",
          row.k === "del" && !row.r && "bg-muted/40",
        )}
      >
        {row.r ? (
          <>
            <span className="w-8 shrink-0 select-none text-right text-muted-foreground">{row.r.n}</span>
            <span className="whitespace-pre text-foreground">{row.r.t}</span>
          </>
        ) : (
          <span className="w-8 shrink-0" />
        )}
      </div>
    </div>
  );
}

function UnifiedRow({ row }: { row: DiffRow }) {
  const side = row.k === "add" ? row.r : row.l;
  const sign = row.k === "add" ? "+" : row.k === "del" ? "−" : " ";
  return (
    <div
      className={cn(
        "flex h-5 min-w-max items-center gap-2 px-2 font-mono text-code leading-5",
        row.k === "add" && "bg-success/15",
        row.k === "del" && "bg-destructive/15",
      )}
    >
      <span className="w-8 shrink-0 select-none text-right text-muted-foreground">{side?.n}</span>
      <span
        className={cn(
          "w-3 shrink-0 select-none text-center",
          row.k === "add" && "text-success",
          row.k === "del" && "text-destructive",
        )}
      >
        {sign}
      </span>
      <span className="whitespace-pre text-foreground">{side?.t}</span>
    </div>
  );
}

/**
 * Recycled diff primitive (build-spec §2). Side-by-side Split / Unified toggle,
 * added/removed/context lines, horizontal scroll for long lines, virtualized
 * body for long diffs, Close → previous mode. Fed by the DiffDoc contract.
 */
export function DiffView({ doc = mockDiff }: { doc?: DiffDoc }) {
  const { t } = useTranslation();
  const setMode = useLayout((s) => s.setMode);
  const previousMode = useLayout((s) => s.previousMode);
  const [view, setView] = React.useState<"split" | "unified">("split");

  return (
    <div data-testid="diff-view" className="flex h-full min-h-0 flex-col bg-editor">
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border bg-card px-2 text-ui">
        <Icon icon={FileCode2} size={13} className="text-muted-foreground" />
        <span data-testid="diff-file" className="font-mono text-code text-foreground">
          {doc.file}
        </span>
        <span className="font-mono text-micro">
          <span className="text-success">+{doc.added}</span>{" "}
          <span className="text-destructive">−{doc.removed}</span>
        </span>
        <div className="flex-1" />
        <ToggleGroup
          type="single"
          size="sm"
          value={view}
          onValueChange={(v) => v && setView(v as "split" | "unified")}
          aria-label={t("diff.split")}
        >
          <ToggleGroupItem value="split" data-testid="diff-toggle-split" className="h-6 px-2 text-micro">
            {t("diff.split")}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="unified"
            data-testid="diff-toggle-unified"
            className="h-6 px-2 text-micro"
          >
            {t("diff.unified")}
          </ToggleGroupItem>
        </ToggleGroup>
        <button
          type="button"
          aria-label={t("diff.close")}
          title={t("diff.close")}
          data-testid="diff-close"
          onClick={() => setMode(previousMode === "diff" ? "editor" : previousMode)}
          className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="size-4" strokeWidth={1.6} aria-hidden />
        </button>
      </div>
      <VirtualList
        testid="diff-body"
        items={doc.rows}
        rowHeight={ROW_HEIGHT}
        className="min-h-0 flex-1"
        renderRow={(row) => (view === "split" ? <SplitRow row={row} /> : <UnifiedRow row={row} />)}
      />
    </div>
  );
}
