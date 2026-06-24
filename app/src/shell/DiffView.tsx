import * as React from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { FileIcon } from "@/shell/editor/FileIcon";
import { VirtualList } from "@/components/ui/virtual-list";
import type { DiffDoc, DiffRow } from "@/contracts";
import { mockDiff } from "@/mocks";
import { useLayout } from "./store";

const ROW_HEIGHT = 20;

function SplitRow({ row }: { row: DiffRow }) {
  const leftCls =
    "dv-cell" + (row.k === "del" ? " del" : row.k === "add" && !row.l ? " filler" : "");
  const rightCls =
    "dv-cell" + (row.k === "add" ? " add" : row.k === "del" && !row.r ? " filler" : "");
  return (
    <div className="dv-line">
      <div className={leftCls}>
        {row.l ? (
          <>
            <span className="dv-ln">{row.l.n}</span>
            <span className="dv-code">{row.l.t}</span>
          </>
        ) : (
          <span className="dv-ln" />
        )}
      </div>
      <div className={rightCls}>
        {row.r ? (
          <>
            <span className="dv-ln">{row.r.n}</span>
            <span className="dv-code">{row.r.t}</span>
          </>
        ) : (
          <span className="dv-ln" />
        )}
      </div>
    </div>
  );
}

function UnifiedRow({ row }: { row: DiffRow }) {
  const side = row.k === "add" ? row.r : row.l;
  const sign = row.k === "add" ? "+" : row.k === "del" ? "−" : " ";
  return (
    <div className={"dv-uline " + row.k}>
      <span className="dv-ln">{side?.n}</span>
      <span className="dv-sign">{sign}</span>
      <span className="dv-code">{side?.t}</span>
    </div>
  );
}

/**
 * Diff view — 1:1 port of the prototype `DiffView` (views.jsx): `.diffview` with
 * a `.dv-head` (file · +/− stat · Split/Unified `.dv-toggle` · close) and a
 * virtualized `.dv-body` (`.dv-line`/`.dv-cell` split, `.dv-uline` unified).
 * Classes verbatim; DiffDoc data + testids preserved.
 */
export function DiffView({ doc = mockDiff }: { doc?: DiffDoc }) {
  const { t } = useTranslation();
  const setMode = useLayout((s) => s.setMode);
  const previousMode = useLayout((s) => s.previousMode);
  const [view, setView] = React.useState<"split" | "unified">("split");

  return (
    <div data-testid="diff-view" className="diffview">
      <div className="dv-head">
        <FileIcon ext="ts" />
        <span data-testid="diff-file" className="dv-file">
          {doc.file}
        </span>
        <span className="dv-stat">
          <span className="gd-add">+{doc.added}</span>
          <span className="gd-del">−{doc.removed}</span>
        </span>
        <div className="tb-spacer" />
        <div className="dv-toggle" role="group" aria-label={t("diff.split")}>
          <button
            type="button"
            data-testid="diff-toggle-split"
            aria-pressed={view === "split"}
            className={view === "split" ? "active" : ""}
            onClick={() => setView("split")}
          >
            {t("diff.split")}
          </button>
          <button
            type="button"
            data-testid="diff-toggle-unified"
            aria-pressed={view === "unified"}
            className={view === "unified" ? "active" : ""}
            onClick={() => setView("unified")}
          >
            {t("diff.unified")}
          </button>
        </div>
        <button
          type="button"
          aria-label={t("diff.close")}
          title={t("diff.close")}
          data-testid="diff-close"
          onClick={() => setMode(previousMode === "diff" ? "editor" : previousMode)}
          className="dv-close focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="size-4" strokeWidth={1.6} aria-hidden />
        </button>
      </div>
      <VirtualList
        testid="diff-body"
        items={doc.rows}
        rowHeight={ROW_HEIGHT}
        className="dv-body"
        renderRow={(row) =>
          view === "split" ? <SplitRow row={row} /> : <UnifiedRow row={row} />
        }
      />
    </div>
  );
}
