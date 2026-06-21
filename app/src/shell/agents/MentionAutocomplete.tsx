import * as React from "react";
import { useTranslation } from "react-i18next";
import { FolderGit2 } from "lucide-react";
import type { RecentProject } from "@/contracts";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { getProviders } from "@/lib/desktop-shell";
import { activeMention, insertReference, matchProjects } from "@/lib/mention/mention-query";

/**
 * `@project` mention autocomplete (road-to-cross-project-knowledge P1). A
 * self-contained input wrapper for a markdown/notes/ToDo/composer context: as
 * the user types `@…` it queries the passive recent-projects registry (project
 * NAMES, not methods — symbol autocomplete is an explicit later phase) and
 * surfaces a small list; picking one inserts a canonical `@name ` reference
 * that knows the on-disk path.
 *
 * The reference is clickable through the registry: an entry whose path still
 * exists opens it via the existing "open project" flow; a STALE path (project
 * moved/renamed/deleted) is handled QUIETLY — a soft "no longer exists" note,
 * never a dead link or an error spew (feature note round 3 caveat).
 *
 * The list is overlay-only and never mounts in the visual harness default boot
 * (it appears strictly on an `@` keypress), so the pixel goldens stay intact.
 */

export interface MentionAutocompleteProps
  extends Omit<React.ComponentProps<typeof Input>, "onSelect"> {
  /** Current project name, excluded from the suggestions (never @-mention self). */
  currentProject?: string;
  /**
   * Open a chosen reference. Receives the registry entry; resolves to whether
   * the project still exists (false → the autocomplete shows the quiet stale
   * note). Defaults to the shared open-project flow.
   */
  onOpenReference?: (project: RecentProject) => Promise<boolean>;
}

export const MentionAutocomplete = React.forwardRef<HTMLInputElement, MentionAutocompleteProps>(
  ({ currentProject, onOpenReference, onKeyDown, className, ...inputProps }, forwardedRef) => {
    const { t } = useTranslation();
    const innerRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement);

    const [projects, setProjects] = React.useState<RecentProject[]>([]);
    const [query, setQuery] = React.useState<string | null>(null);
    const [highlight, setHighlight] = React.useState(0);
    const [staleName, setStaleName] = React.useState<string | null>(null);

    // Load the registry lazily on first interaction (not on mount → no work in
    // the visual harness, no list before the user reaches for it).
    const ensureLoaded = React.useCallback(() => {
      if (projects.length > 0) return;
      void getProviders()
        .recent.list()
        .then(setProjects);
    }, [projects.length]);

    const hits = query === null ? [] : matchProjects(projects, query, currentProject);
    const open = query !== null && hits.length > 0;

    const refresh = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      const m = activeMention(el.value, el.selectionStart ?? el.value.length);
      if (!m) {
        setQuery(null);
        return;
      }
      ensureLoaded();
      setStaleName(null);
      setHighlight(0);
      setQuery(m.query);
    }, [ensureLoaded]);

    const choose = React.useCallback(
      async (project: RecentProject) => {
        const el = innerRef.current;
        if (el) {
          const m = activeMention(el.value, el.selectionStart ?? el.value.length);
          if (m) {
            const out = insertReference(el.value, m, project);
            el.value = out.text;
            el.setSelectionRange(out.caret, out.caret);
          }
        }
        setQuery(null);
        // Clickable reference: open the project through the existing flow. A
        // stale path resolves `false` → quiet note, no dead link.
        const opener =
          onOpenReference ??
          (async (p: RecentProject) => {
            const fs = getProviders().projectFs;
            try {
              await fs.openProject(p.path);
              return true;
            } catch {
              return false;
            }
          });
        const exists = await opener(project);
        setStaleName(exists ? null : project.name);
        el?.focus();
      },
      [onOpenReference],
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (open) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlight((h) => (h + 1) % hits.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlight((h) => (h - 1 + hits.length) % hits.length);
          return;
        }
        if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          void choose(hits[highlight] ?? hits[0]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setQuery(null);
          return;
        }
      }
      onKeyDown?.(e);
    };

    return (
      <div className="relative">
        <Input
          ref={innerRef}
          className={className}
          onKeyDown={handleKeyDown}
          onInput={refresh}
          onClick={refresh}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? "mention-listbox" : undefined}
          {...inputProps}
        />
        {open && (
          <ul
            id="mention-listbox"
            role="listbox"
            data-testid="mention-listbox"
            className="absolute bottom-full left-0 z-50 mb-1 max-h-56 w-72 overflow-auto rounded-md border border-border bg-popover p-1 shadow-md"
          >
            {hits.map((p, i) => (
              <li key={p.path} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  data-testid={`mention-option-${p.name}`}
                  // mousedown (not click) so the input does not blur first
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void choose(p);
                  }}
                  className={cn(
                    "flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-ui focus-visible:outline-none",
                    i === highlight ? "bg-accent text-foreground" : "text-foreground hover:bg-accent",
                  )}
                >
                  <FolderGit2 className="size-3.5 text-muted-foreground" strokeWidth={1.6} />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.branch ? (
                    <span className="font-mono text-[11px] text-muted-foreground">{p.branch}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        {staleName && (
          <div
            data-testid="mention-stale"
            role="status"
            className="absolute bottom-full left-0 z-50 mb-1 rounded-md border border-border bg-muted px-2 py-1 text-micro text-muted-foreground"
          >
            {t("mention.stale", { name: staleName })}
          </div>
        )}
      </div>
    );
  },
);
MentionAutocomplete.displayName = "MentionAutocomplete";
