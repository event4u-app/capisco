import * as React from "react";
import { useTranslation } from "react-i18next";
import type { RecentProject } from "@/contracts";
import { Input } from "@/components/ui/input";
import { getProviders } from "@/lib/desktop-shell";
import { useAutocompleteEngine, type MentionFieldElement } from "@/lib/autocomplete/engine";
import { makeProjectProvider } from "@/lib/autocomplete/providers/project-provider";
import type { AutocompleteItem, AutocompleteProvider } from "@/lib/autocomplete/types";

/**
 * `@project` mention autocomplete (road-to-cross-project-knowledge P1, re-mounted
 * on the shared autocomplete engine in road-to-composer-intelligence P0). A
 * self-contained input wrapper: as the user types `@…` it queries the passive
 * recent-projects registry (project NAMES, not methods — symbol autocomplete is
 * a later, gated phase) and surfaces a small list; picking one inserts a
 * canonical `@name ` reference that knows the on-disk path.
 *
 * The reference is clickable through the registry: an entry whose path still
 * exists opens it via the existing "open project" flow; a STALE path is handled
 * QUIETLY — a soft "no longer exists" note, never a dead link or error spew.
 *
 * The list is overlay-only and never mounts in the visual harness default boot
 * (it appears strictly on an `@` keypress), so the pixel goldens stay intact.
 * P0 change is internal only: the trigger detection, keyboard, and overlay state
 * now live in the shared engine; `@project` is its first provider. The rendered
 * DOM is byte-identical to the pre-P0 component.
 */

export type { MentionFieldElement };

export interface MentionAutocompleteProps extends Omit<
  React.ComponentProps<typeof Input>,
  "onSelect"
> {
  /** Current project name, excluded from the suggestions (never @-mention self). */
  currentProject?: string;
  /**
   * Open a chosen reference. Receives the registry entry; resolves to whether
   * the project still exists (false → the autocomplete shows the quiet stale
   * note). Defaults to the shared open-project flow.
   */
  onOpenReference?: (project: RecentProject) => Promise<boolean>;
  /**
   * Render a multi-line `<textarea>` instead of the single-line `<Input>`
   * (design-sync-v2 composer graft). The @-mention logic is identical — it
   * operates on `value` / `selectionStart` / `setSelectionRange`, which both
   * element types share. Default false → byte-identical single-line behaviour.
   */
  multiline?: boolean;
  /** Textarea row count when `multiline` (default 3). */
  rows?: number;
  /**
   * Providers beyond the built-in `@project` one (e.g. the `/`-command provider
   * the composer passes). Memoize the array at the call site so the engine does
   * not re-query on every render. `@project`-only callers omit it.
   */
  extraProviders?: AutocompleteProvider<AutocompleteItem>[];
}

export const MentionAutocomplete = React.forwardRef<
  MentionFieldElement,
  MentionAutocompleteProps
>(
  (
    {
      currentProject,
      onOpenReference,
      onKeyDown,
      className,
      multiline,
      rows = 3,
      extraProviders,
      ...inputProps
    },
    forwardedRef,
  ) => {
    const { t } = useTranslation();
    const innerRef = React.useRef<MentionFieldElement>(null);
    React.useImperativeHandle(forwardedRef, () => innerRef.current as MentionFieldElement);

    const [projects, setProjects] = React.useState<RecentProject[]>([]);
    const [staleName, setStaleName] = React.useState<string | null>(null);

    // Load the registry lazily on first interaction (not on mount → no work in
    // the visual harness, no list before the user reaches for it).
    const ensureLoaded = React.useCallback(() => {
      if (projects.length > 0) return;
      void getProviders().recent.list().then(setProjects);
    }, [projects.length]);

    const provider = React.useMemo(
      () =>
        makeProjectProvider({
          projects,
          currentProject,
          onOpenReference,
          onStale: setStaleName,
        }),
      [projects, currentProject, onOpenReference],
    );

    // `@project` first, then any caller-supplied providers (e.g. `/` commands).
    const providers = React.useMemo<AutocompleteProvider<AutocompleteItem>[]>(
      () =>
        extraProviders && extraProviders.length > 0
          ? [provider as AutocompleteProvider<AutocompleteItem>, ...extraProviders]
          : [provider as AutocompleteProvider<AutocompleteItem>],
      [provider, extraProviders],
    );

    const engine = useAutocompleteEngine(innerRef, providers, {
      onBeforeQuery: ensureLoaded,
      onKeyDownPassthrough: onKeyDown as
        | ((e: React.KeyboardEvent<MentionFieldElement>) => void)
        | undefined,
    });

    // A fresh `@` clears any lingering stale note (matches pre-P0 behaviour).
    React.useEffect(() => {
      if (engine.token) setStaleName(null);
    }, [engine.token]);

    return (
      <div className="relative">
        {multiline ? (
          // Bare textarea — the caller owns ALL styling via `className` (the
          // composer passes the design-system `cmp-ta` class verbatim). No
          // Tailwind base here, so the field is pixel-1:1 with the prototype.
          <textarea
            ref={innerRef as React.Ref<HTMLTextAreaElement>}
            rows={rows}
            className={className}
            {...(engine.inputProps as React.ComponentProps<"textarea">)}
            {...(inputProps as React.ComponentProps<"textarea">)}
            // Compose: the engine's token-refresh MUST run, plus the caller's
            // onInput (draft autosave / auto-grow) — the spread order would
            // otherwise let one clobber the other.
            onInput={(e) => {
              engine.inputProps.onInput();
              (inputProps as React.ComponentProps<"textarea">).onInput?.(e);
            }}
          />
        ) : (
          <Input
            ref={innerRef as React.Ref<HTMLInputElement>}
            className={className}
            {...engine.inputProps}
            {...inputProps}
            onInput={(e) => {
              engine.inputProps.onInput();
              (inputProps as React.ComponentProps<"input">).onInput?.(e);
            }}
          />
        )}
        {engine.open && (
          <ul
            id="mention-listbox"
            role="listbox"
            data-testid="mention-listbox"
            className="absolute bottom-full left-0 z-50 mb-1 max-h-56 w-72 overflow-auto rounded-md border border-border bg-popover p-1 shadow-md"
          >
            {engine.items.map((item, i) => (
              <li key={item.id} role="presentation">
                {/* Dispatch to the ACTIVE token's provider (@project or /command),
                    never a hardcoded one — required once >1 provider is mounted. */}
                {engine.provider?.renderItem(item, {
                  highlighted: i === engine.highlight,
                  index: i,
                  onChoose: engine.choose,
                })}
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
