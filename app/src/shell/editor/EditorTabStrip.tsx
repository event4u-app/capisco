import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pin, PinOff, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { FileIcon } from "./FileIcon";
import { useEditor, type EditorTabState } from "./store";

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
          <span className="max-w-40 truncate">{tab.label}</span>
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

/**
 * Editor tab strip (roadmap Phase 0): pinnable, drag-reorder, dirty indicator,
 * double-click rename. The active tab adopts the editor background so it merges
 * downward into the code pane.
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
  const dragRef = React.useRef<string | null>(null);

  return (
    <div
      role="toolbar"
      aria-label={t("editor.tabStrip")}
      data-testid="editor-tab-strip"
      className="flex h-8 shrink-0 items-stretch overflow-x-auto border-b border-border bg-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
  );
}
