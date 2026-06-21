import * as React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Pin, PinOff, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileIcon } from "./FileIcon";
import { useEditor, type EditorTabState } from "./store";
import { useTabRows, type TabRows } from "./tab-rows-store";

function Tab({
  tab,
  active,
  onSelect,
  onClose,
  onTogglePin,
  onRename,
  onDragStart,
  onDrop,
}: {
  tab: EditorTabState;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  onTogglePin: () => void;
  onRename: (label: string) => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(tab.label);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next) onRename(next);
    else setDraft(tab.label);
    setEditing(false);
  };

  return (
    // Layout-only host (no interactive role) so the selectable tab button and
    // the pin/close buttons are siblings — never nested interactives (axe).
    <div
      data-testid={`editor-tab-${tab.file}`}
      data-active={active || undefined}
      data-pinned={tab.pinned || undefined}
      data-dirty={tab.dirty || undefined}
      draggable={!editing}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setDraft(tab.label);
        setEditing(true);
      }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={cn(
        "group relative flex h-8 items-stretch border-r border-border text-ui",
        active
          ? "bg-editor text-foreground"
          : "bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {/* Active tab adopts the editor bg + top teal strip (merge downward). */}
      {active && (
        <span aria-hidden className="absolute left-0 top-0 h-0.5 w-full bg-primary" />
      )}
      {editing ? (
        <div className="flex items-center gap-1.5 pl-3">
          <FileIcon ext={tab.ext} />
          <input
            ref={inputRef}
            data-testid={`editor-tab-rename-${tab.file}`}
            aria-label={t("editor.tab.rename")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              else if (e.key === "Escape") {
                setDraft(tab.label);
                setEditing(false);
              }
            }}
            className="w-28 rounded-sm border border-border bg-muted px-1 font-mono text-ui text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      ) : (
        <button
          type="button"
          aria-pressed={active}
          data-testid={`editor-tab-select-${tab.file}`}
          onClick={onSelect}
          className="flex cursor-pointer items-center gap-1.5 pl-3 pr-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <FileIcon ext={tab.ext} />
          {/* File tabs stay UNTRIMMED (Design-Sync P1/P2) — full name, no ellipsis. */}
          <span className="whitespace-nowrap">{tab.label}</span>
        </button>
      )}

      <div className="flex items-center gap-1 pr-2">
      {/* Pin toggle — appears on hover / when pinned. */}
      <button
        type="button"
        aria-label={tab.pinned ? t("editor.tab.unpin") : t("editor.tab.pin")}
        title={tab.pinned ? t("editor.tab.unpin") : t("editor.tab.pin")}
        data-testid={`editor-tab-pin-${tab.file}`}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin();
        }}
        className={cn(
          "flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          tab.pinned ? "text-primary" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        <Icon icon={tab.pinned ? Pin : PinOff} size={12} />
      </button>

      {/* Dirty dot OR close affordance (close hidden for pinned tabs). */}
      {tab.dirty ? (
        <span
          role="img"
          data-testid={`editor-tab-dirty-${tab.file}`}
          className="size-1.5 rounded-full bg-muted-foreground"
          aria-label={t("editor.tab.unsaved")}
        />
      ) : (
        !tab.pinned && (
          <button
            type="button"
            aria-label={t("editor.tab.close", { name: tab.label })}
            data-testid={`editor-tab-close-${tab.file}`}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex size-4 items-center justify-center rounded-sm text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100"
          >
            <Icon icon={X} size={12} />
          </button>
        )
      )}
      </div>
    </div>
  );
}

/** Single editor-tab height (matches the `h-8` Tab host) — drives the multi-row
 * max-height so N rows show exactly N tab heights before scrolling. */
const TAB_H = 32;
const ROW_OPTIONS: TabRows[] = [1, 2, 3];

/**
 * Overflow dropdown (Design-Sync P1): a chevron on the right of the strip that
 * lists EVERY open tab (pin / dirty markers, click jumps to the tab) and hosts
 * the "Tab rows" 1/2/3 segmented control in its header.
 */
function OverflowMenu({
  tabs,
  activeFile,
  onSelect,
}: {
  tabs: EditorTabState[];
  activeFile: string;
  onSelect: (file: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const rows = useTabRows((s) => s.rows);
  const setRows = useTabRows((s) => s.setRows);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("editor.overflow.open")}
          title={t("editor.overflow.open")}
          data-testid="editor-tab-overflow"
          aria-pressed={open}
          className={cn(
            "flex w-8 shrink-0 items-center justify-center self-stretch border-l border-border text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
            open && "bg-accent text-foreground",
          )}
        >
          <Icon icon={ChevronDown} size={15} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={4} className="w-60 p-1" data-testid="editor-tab-menu">
        <div
          className="mb-1 flex items-center justify-between gap-2 border-b border-border px-2 pb-1.5 pt-1"
          data-testid="editor-tab-rows"
        >
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("editor.overflow.rows")}
          </span>
          <div role="group" aria-label={t("editor.overflow.rows")} className="flex gap-0.5 rounded-sm border border-border bg-muted p-0.5">
            {ROW_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={rows === n}
                data-testid={`editor-tab-rows-${n}`}
                onClick={() => setRows(n)}
                className={cn(
                  "h-5 w-6 rounded-sm text-ui focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  rows === n
                    ? "bg-primary/20 font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.file}
              type="button"
              data-testid={`editor-tab-menu-item-${tab.file}`}
              aria-current={tab.file === activeFile || undefined}
              onClick={() => {
                onSelect(tab.file);
                setOpen(false);
              }}
              className={cn(
                "flex h-7 w-full items-center gap-1.5 rounded-sm px-2 text-left text-ui hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                tab.file === activeFile ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <FileIcon ext={tab.ext} />
              <span className="min-w-0 flex-1 truncate">{tab.label}</span>
              {tab.pinned && <Icon icon={Pin} size={11} className="shrink-0 text-muted-foreground" />}
              {tab.dirty && (
                <span
                  className="size-1.5 shrink-0 rounded-full bg-muted-foreground"
                  data-testid={`editor-tab-menu-dirty-${tab.file}`}
                  aria-hidden
                />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Editor tab strip (Phase 0 + Design-Sync P1): pinnable, drag-reorder, dirty
 * indicator, double-click rename, plus a row-count setting (1/2/3) and an
 * overflow dropdown. The active tab adopts the editor background so it merges
 * downward into the code pane.
 *
 * - `rows === 1` (default): single row, horizontal trackpad/swipe scroll.
 * - `rows >= 2`: tabs wrap into rows, the strip caps at `rows * 32px` and
 *   scrolls vertically beyond that.
 */
export function EditorTabStrip() {
  const { t } = useTranslation();
  const tabs = useEditor((s) => s.tabs);
  const activeFile = useEditor((s) => s.activeFile);
  const setActive = useEditor((s) => s.setActive);
  const closeTab = useEditor((s) => s.closeTab);
  const togglePin = useEditor((s) => s.togglePin);
  const rename = useEditor((s) => s.rename);
  const reorder = useEditor((s) => s.reorder);
  const rows = useTabRows((s) => s.rows);
  const dragRef = React.useRef<string | null>(null);
  const multi = rows > 1;

  return (
    <div
      role="toolbar"
      aria-label={t("editor.tabStrip")}
      data-testid="editor-tab-strip"
      data-rows={rows}
      className="flex shrink-0 items-stretch border-b border-border bg-card"
    >
      <div
        data-testid="editor-tab-scroll"
        className={cn(
          "flex flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          multi
            ? "flex-wrap content-start overflow-y-auto"
            : "items-stretch overflow-x-auto",
        )}
        // Multi-row caps the strip at N tab-heights (then scrolls); single-row
        // is one tab tall.
        style={multi ? { maxHeight: rows * TAB_H } : undefined}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.file}
            tab={tab}
            active={tab.file === activeFile}
            onSelect={() => setActive(tab.file)}
            onClose={() => closeTab(tab.file)}
            onTogglePin={() => togglePin(tab.file)}
            onRename={(label) => rename(tab.file, label)}
            onDragStart={() => (dragRef.current = tab.file)}
            onDrop={() => {
              const drag = dragRef.current;
              if (drag && drag !== tab.file) reorder(drag, tab.file);
              dragRef.current = null;
            }}
          />
        ))}
      </div>
      <OverflowMenu tabs={tabs} activeFile={activeFile} onSelect={setActive} />
    </div>
  );
}
