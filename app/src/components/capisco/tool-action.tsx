import * as React from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Revert glyph — the EXACT SVG path from the prototype
 * (`components/ide/ToolAction.jsx`): an open curved-arrow undo mark, not
 * lucide's circle-arrow `RotateCcw` (which read differently). 24-viewBox,
 * 2px stroke, rendered at 13px to match the design.
 */
function RevertGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}

/**
 * Capisco ToolAction — an agent tool call in the chat transcript (build-spec §4).
 * Verb + mono target + optional diffstat, collapsible, optional open-in-editor,
 * optional revert (design-sync-v2 §4 — discard the *code* hunk, never side
 * effects; see Overview §2.3 honesty invariant). The revert here is a VISUAL
 * stub: the real worktree hunk-revert is wired by road-to-composer-context-runtime.
 */
export interface ToolActionProps {
  kind: string;
  target: string;
  added?: number;
  removed?: number;
  defaultOpen?: boolean;
  onOpenInEditor?: () => void;
  /** Discard the code hunk (NOT a side-effect undo). Renders the revert glyph. */
  onRevert?: () => void;
  children?: React.ReactNode;
}

export function ToolAction({
  kind,
  target,
  added,
  removed,
  defaultOpen = false,
  onOpenInEditor,
  onRevert,
  children,
}: ToolActionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(defaultOpen);
  const collapsible = Boolean(children);
  const hasStat = added != null || removed != null;

  return (
    <div className="rounded-sm border border-border bg-muted/50 text-code">
      <div className="group flex items-center gap-1.5 px-2 py-1">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Collapse" : "Expand"}
            onClick={() => setOpen((o) => !o)}
            className="flex size-4 items-center justify-center text-muted-foreground"
          >
            <ChevronRight
              className={cn("size-3.5 transition-transform", open && "rotate-90")}
              strokeWidth={1.6}
            />
          </button>
        ) : (
          <span className="size-4" />
        )}
        <span className="font-medium text-foreground">{kind}</span>
        <span className="truncate font-mono text-muted-foreground">{target}</span>
        {hasStat && (
          <span className="ml-auto flex gap-1.5 font-mono">
            {added != null && <span className="text-success">+{added}</span>}
            {removed != null && <span className="text-destructive">&minus;{removed}</span>}
          </span>
        )}
        {onRevert && (
          <button
            type="button"
            onClick={onRevert}
            aria-label={t("agents.toolAction.revert")}
            title={t("agents.toolAction.revert")}
            data-testid="tool-action-revert"
            className={cn(
              "inline-flex items-center justify-center text-muted-foreground group-hover:text-warning",
              !hasStat && !onOpenInEditor && "ml-auto",
            )}
          >
            <RevertGlyph />
          </button>
        )}
        {onOpenInEditor && (
          <button
            type="button"
            onClick={onOpenInEditor}
            aria-label="Open in editor"
            className={cn(
              "text-muted-foreground group-hover:text-primary",
              !hasStat && !onRevert && "ml-auto",
            )}
          >
            <ExternalLink className="size-3.5" strokeWidth={1.6} />
          </button>
        )}
      </div>
      {collapsible && open && (
        <div className="border-t border-border px-2 py-1 font-mono">{children}</div>
      )}
    </div>
  );
}
