import * as React from "react";
import { Pin, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Capisco EditorTab — pinnable/dirty tab; active tab adopts the editor bg and
 * carries a top teal strip so it merges downward into the editor (build-spec §8).
 */
export interface EditorTabProps {
  name: string;
  icon?: React.ReactNode;
  active?: boolean;
  pinned?: boolean;
  dirty?: boolean;
  onClose?: () => void;
  onClick?: () => void;
}

export function EditorTab({
  name,
  icon,
  active,
  pinned,
  dirty,
  onClose,
  onClick,
}: EditorTabProps) {
  return (
    <div
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative flex h-8 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-ui",
        active
          ? "bg-background text-foreground"
          : "bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {active && <span className="absolute left-0 top-0 h-0.5 w-full bg-primary" />}
      {icon}
      <span className="max-w-40 truncate">{name}</span>
      {pinned ? (
        <Pin className="size-3 text-muted-foreground" strokeWidth={1.6} />
      ) : dirty ? (
        <span className="size-1.5 rounded-full bg-muted-foreground" aria-label="unsaved" />
      ) : (
        onClose && (
          <button
            type="button"
            aria-label={`Close ${name}`}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" strokeWidth={1.6} />
          </button>
        )
      )}
    </div>
  );
}
