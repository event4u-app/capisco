import * as React from "react";
import { useTranslation } from "react-i18next";
import { Replace, Search } from "lucide-react";
import { Icon } from "@/components/icon";
import { VirtualList } from "@/components/ui/virtual-list";
import { FileIcon } from "@/shell/editor/FileIcon";
import type { SearchHit } from "@/contracts";
import { mockSearch } from "@/mocks";
import { useLayout } from "../store";

const ROW_HEIGHT = 22;

type SearchRow =
  | { type: "file"; key: string; path: string; count: number }
  | { type: "hit"; key: string; path: string; hit: SearchHit };

/**
 * Search panel — 1:1 port of the prototype `SearchPanel` (views.jsx): ripgrep
 * results grouped by file (`.sp-*`), highlighted matches, a Replace field. The
 * result list stays virtualized; classes verbatim, data/logic/testids preserved.
 */
export function SearchPanel() {
  const { t } = useTranslation();
  const setMode = useLayout((s) => s.setMode);
  const s = mockSearch;
  const [query, setQuery] = React.useState(s.query);
  const [replace, setReplace] = React.useState("");
  const totalHits = s.files.reduce((n, f) => n + f.hits.length, 0);

  const rows = React.useMemo<SearchRow[]>(() => {
    const out: SearchRow[] = [];
    for (const f of s.files) {
      out.push({ type: "file", key: `f:${f.path}`, path: f.path, count: f.hits.length });
      f.hits.forEach((h, i) => out.push({ type: "hit", key: `h:${f.path}:${i}`, path: f.path, hit: h }));
    }
    return out;
  }, [s.files]);

  return (
    <div data-testid="search-panel" className="explorer">
      <div className="sp-head">
        <label className="as-input flex items-center gap-1.5">
          <Icon icon={Search} size={13} className="shrink-0 text-muted-foreground" />
          <input
            data-testid="search-query"
            aria-label={t("search.queryLabel")}
            value={query}
            placeholder={t("search.queryPlaceholder")}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent font-mono text-code text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <label className="as-input mt-1.5 flex items-center gap-1.5">
          <Icon icon={Replace} size={13} className="shrink-0 text-muted-foreground" />
          <input
            data-testid="search-replace"
            aria-label={t("search.replaceLabel")}
            value={replace}
            placeholder={t("search.replacePlaceholder")}
            onChange={(e) => setReplace(e.target.value)}
            className="min-w-0 flex-1 bg-transparent font-mono text-code text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <p data-testid="search-summary" className="sp-summary">
          {t("search.summary", { results: totalHits, files: s.files.length })}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-3 py-2 text-micro text-muted-foreground">{t("search.empty")}</p>
      ) : (
        <VirtualList
          testid="search-results"
          items={rows}
          rowHeight={ROW_HEIGHT}
          className="sp-scroll"
          renderRow={(row) =>
            row.type === "file" ? (
              <SearchFileHeader path={row.path} count={row.count} />
            ) : (
              <SearchHitRow hit={row.hit} onOpen={() => setMode("diff")} />
            )
          }
        />
      )}
    </div>
  );
}

function SearchFileHeader({ path, count }: { path: string; count: number }) {
  return (
    <div data-testid={`search-file-${path}`} className="sp-fpath">
      <FileIcon ext={path.split(".").pop() ?? "ts"} />
      <span className="sp-fname">{path}</span>
      <span className="sec-count">{count}</span>
    </div>
  );
}

function SearchHitRow({ hit, onOpen }: { hit: SearchHit; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" className="sp-hit w-full text-left" onClick={onOpen} title={t("diff.open")}>
      <span className="sp-ln">{hit.line}</span>
      <span className="sp-code">
        {hit.before}
        <mark className="sp-mark">{hit.match}</mark>
        {hit.after}
      </span>
    </button>
  );
}
