import * as React from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Capisco ToolAction — an agent tool call in the chat transcript (build-spec §4).
 * Verb + mono target + optional diffstat, collapsible, optional open-in-editor.
 */
export interface ToolActionProps {
  kind: string;
  target: string;
  added?: number;
  removed?: number;
  defaultOpen?: boolean;
  onOpenInEditor?: () => void;
  children?: React.ReactNode;
}

export function ToolAction({
  kind,
  target,
  added,
  removed,
  defaultOpen = false,
  onOpenInEditor,
  children,
}: ToolActionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const collapsible = Boolean(children);
  const hasStat = added != null || removed != null;

  return (
    <div className="rounded-sm border border-border bg-muted/50 text-code">
      <div className="flex items-center gap-1.5 px-2 py-1">
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
        {onOpenInEditor && (
          <button
            type="button"
            onClick={onOpenInEditor}
            aria-label="Open in editor"
            className={cn("text-muted-foreground hover:text-foreground", !hasStat && "ml-auto")}
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
