import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Capisco Tree — accessible, virtualization-friendly file/symbol tree.
 * Caller passes a FLAT list of currently-visible rows (depth carries nesting),
 * so the same component wraps trivially in a virtualizer for heavy trees (R4).
 * Density matches the concept: 26px rows, depth indent 12px, teal active strip.
 */
export interface TreeRowData {
  id: string;
  label: string;
  depth: number;
  expandable?: boolean;
  expanded?: boolean;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}

export interface TreeProps {
  rows: TreeRowData[];
  activeId?: string;
  onSelect?: (id: string) => void;
  onToggle?: (id: string) => void;
  rowHeight?: number;
  className?: string;
  label?: string;
}

export function Tree({
  rows,
  activeId,
  onSelect,
  onToggle,
  rowHeight = 26,
  className,
  label,
}: TreeProps) {
  const [focusIdx, setFocusIdx] = React.useState(0);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const r = rows[focusIdx];
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "ArrowRight") {
      if (r?.expandable && !r.expanded) onToggle?.(r.id);
    } else if (e.key === "ArrowLeft") {
      if (r?.expandable && r.expanded) onToggle?.(r.id);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (r) onSelect?.(r.id);
    }
  };

  return (
    <div
      role="tree"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn("select-none text-ui outline-none", className)}
    >
      {rows.map((row, i) => (
        <TreeRow
          key={row.id}
          row={row}
          active={row.id === activeId}
          focused={i === focusIdx}
          rowHeight={rowHeight}
          onSelect={() => {
            setFocusIdx(i);
            onSelect?.(row.id);
          }}
          onToggle={() => onToggle?.(row.id)}
        />
      ))}
    </div>
  );
}

function TreeRow({
  row,
  active,
  focused,
  rowHeight,
  onSelect,
  onToggle,
}: {
  row: TreeRowData;
  active: boolean;
  focused: boolean;
  rowHeight: number;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={active}
      aria-expanded={row.expandable ? !!row.expanded : undefined}
      onClick={onSelect}
      style={{ height: rowHeight, paddingLeft: 4 + row.depth * 12 }}
      className={cn(
        "relative flex cursor-pointer items-center gap-1.5 rounded-sm pr-2 hover:bg-accent",
        active && "bg-accent",
        focused && "ring-1 ring-ring",
      )}
    >
      {active && <span className="absolute left-0 top-0 h-full w-0.5 bg-primary" />}
      {row.expandable ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={row.expanded ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex size-4 items-center justify-center text-muted-foreground"
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform", row.expanded && "rotate-90")}
            strokeWidth={1.6}
          />
        </button>
      ) : (
        <span className="size-4" />
      )}
      {row.icon}
      <span className="truncate text-foreground">{row.label}</span>
      {row.trailing && <span className="ml-auto pl-2">{row.trailing}</span>}
    </div>
  );
}
