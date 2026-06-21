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

/** A flattened, virtualizable search row: a file header or one match line. */
type SearchRow =
  | { type: "file"; key: string; path: string; count: number }
  | { type: "hit"; key: string; path: string; hit: SearchHit };

/**
 * Search panel (build-spec §3) — ripgrep-style results grouped by file with
 * line numbers, highlighted matches, and a Replace field. The result list is
 * virtualized (file headers + hit lines share one fixed-row windowed model) so
 * a workspace-wide search stays responsive.
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
    <div data-testid="search-panel" className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border p-2">
        <label className="flex h-6 items-center gap-1.5 rounded-sm border border-border bg-input px-1.5">
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
        <label className="mt-1.5 flex h-6 items-center gap-1.5 rounded-sm border border-border bg-input px-1.5">
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
        <p data-testid="search-summary" className="mt-1.5 text-micro text-muted-foreground">
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
          className="min-h-0 flex-1"
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
    <div
      data-testid={`search-file-${path}`}
      className="flex h-[22px] items-center gap-1.5 bg-card px-2 text-ui"
    >
      <span className="flex shrink-0 items-center">
        <FileIcon ext={path.split(".").pop() ?? "ts"} />
      </span>
      <span className="truncate font-mono text-code text-foreground">{path}</span>
      <span className="ml-auto shrink-0 rounded-full bg-secondary px-1.5 text-[10px] text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

function SearchHitRow({ hit, onOpen }: { hit: SearchHit; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      title={t("diff.open")}
      className="flex h-[22px] w-full items-center gap-2 px-2 pl-5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span className="w-8 shrink-0 select-none text-right font-mono text-micro text-muted-foreground">
        {hit.line}
      </span>
      <span className="truncate font-mono text-code text-foreground">
        {hit.before}
        <mark className="rounded-[2px] bg-warning/30 text-foreground">{hit.match}</mark>
        {hit.after}
      </span>
    </button>
  );
}
