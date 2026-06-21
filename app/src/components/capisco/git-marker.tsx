import { cn } from "@/lib/utils";
import type { GitMarker as GitMarkerStatus } from "@/contracts";

const COLORS: Record<GitMarkerStatus, string> = {
  M: "text-git-modified",
  A: "text-git-added",
  D: "text-git-deleted",
  U: "text-muted-foreground",
};

/** Git status letter (Modified / Added / Deleted / Untracked), muted + mono. */
export function GitMarker({ status }: { status: GitMarkerStatus }) {
  return (
    <span className={cn("font-mono text-micro font-medium", COLORS[status])}>{status}</span>
  );
}
