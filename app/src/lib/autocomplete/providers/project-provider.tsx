/**
 * `@project` autocomplete provider (road-to-composer-intelligence P0). Wraps the
 * untouched `matchProjects` / `insertReference` helpers so the existing
 * `mention-query` goldens stay green; the only new behavior is that selection is
 * a pure insertion plus an OPT-IN `sideEffect` (open the project) — the engine
 * no longer ejects the user out of the composer as a hard consequence of picking.
 *
 * `renderItem` reproduces the prior `MentionAutocomplete` option markup
 * byte-for-byte (same classes, testid, icon, branch span) so the DOM — and the
 * composer pixel-goldens — do not move.
 */

import { FolderGit2 } from "lucide-react";
import type { RecentProject } from "@/contracts";
import { cn } from "@/lib/utils";
import { getProviders } from "@/lib/desktop-shell";
import { insertReference, matchProjects } from "@/lib/mention/mention-query";
import type { AutocompleteItem, AutocompleteProvider } from "../types";

export interface ProjectItem extends AutocompleteItem {
  project: RecentProject;
  branch?: string;
}

export interface MakeProjectProviderOptions {
  /** The (lazily-loaded) recent-projects registry. */
  projects: RecentProject[];
  /** Current project, excluded from suggestions (never @-mention self). */
  currentProject?: string;
  /** Open a chosen reference; resolves false when the path is stale. */
  onOpenReference?: (project: RecentProject) => Promise<boolean>;
  /** Report a stale pick (path no longer exists) for the quiet note. */
  onStale?: (name: string | null) => void;
}

/** Default opener — the shared open-project flow; stale path resolves false. */
async function defaultOpener(project: RecentProject): Promise<boolean> {
  try {
    await getProviders().projectFs.openProject(project.path);
    return true;
  } catch {
    return false;
  }
}

export function makeProjectProvider(
  opts: MakeProjectProviderOptions,
): AutocompleteProvider<ProjectItem> {
  return {
    triggerChar: "@",
    getItems(query) {
      return matchProjects(opts.projects, query, opts.currentProject).map((p) => ({
        id: p.path,
        label: p.name,
        mruScore: p.lastSeen, // existing recency ordinal becomes the MRU score
        project: p,
        branch: p.branch,
      }));
    },
    renderItem(item, { highlighted, onChoose }) {
      return (
        <button
          type="button"
          role="option"
          aria-selected={highlighted}
          data-testid={`mention-option-${item.label}`}
          // mousedown (not click) so the input does not blur first
          onMouseDown={(e) => {
            e.preventDefault();
            onChoose(item);
          }}
          className={cn(
            "flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-ui focus-visible:outline-none",
            highlighted ? "bg-accent text-foreground" : "text-foreground hover:bg-accent",
          )}
        >
          <FolderGit2 className="size-3.5 text-muted-foreground" strokeWidth={1.6} />
          <span className="flex-1 truncate">{item.label}</span>
          {item.branch ? (
            <span className="font-mono text-[11px] text-muted-foreground">{item.branch}</span>
          ) : null}
        </button>
      );
    },
    onSelect(item, token, bufferText) {
      const out = insertReference(bufferText, token, item.project);
      return {
        text: out.text,
        caret: out.caret,
        sideEffect: async () => {
          const opener = opts.onOpenReference ?? defaultOpener;
          const exists = await opener(item.project);
          opts.onStale?.(exists ? null : item.project.name);
        },
      };
    },
  };
}
