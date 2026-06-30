/**
 * `/`-command autocomplete provider (road-to-composer-intelligence P1). Reads
 * the SAME `usePalette.registered` catalog as Cmd-K (no second drifting source)
 * and surfaces it inline in the composer. Accepting a command EXECUTES it
 * (palette-style) — the `/query` token is excised from the buffer and
 * `command.run()` fires as the engine's opt-in `sideEffect`, never synchronously
 * (mirrors `@project`'s `openProject`, so a mode-switch can't blow up the
 * composer mid-render).
 *
 * Only the dynamically `registered` commands appear — the Cmd-K builtins
 * (workspace-mode / visibility / pin / preset switches) are computed inside the
 * palette and are intentionally NOT in `registered`, so they are structurally
 * excluded from mid-compose (jarring to switch modes while typing).
 */

/* eslint-disable react-refresh/only-export-components -- provider factory + group
   predicates, not a React component module (renderItem is a method, not an export). */
import type { Command } from "@/shell/command-registry";
import { cn } from "@/lib/utils";
import type { AutocompleteItem, AutocompleteProvider } from "../types";

export interface CommandItem extends AutocompleteItem {
  command: Command;
}

/** Decides whether a command's group is shown in the current composer mode. */
export type CommandGroupFilter = (group: Command["group"]) => boolean;

/** Agent / full-IDE mode: every group is shown. */
export const ALL_GROUPS: CommandGroupFilter = () => true;

/**
 * Chat mode: only `tools` (real compose-time actions) survive. `modes` / `view`
 * / `presets` are workspace-layout verbs with no meaning in the stripped chat
 * surface. Exported as the canonical rule so P3/P6 import it instead of
 * re-deriving from `isChat`.
 */
export const CHAT_GROUPS: CommandGroupFilter = (group) => group === "tools";

/** Commands that must never appear in the inline `/` list even though registered. */
const EXCLUDED_IDS = new Set(["composer:stop"]);

export interface MakeCommandProviderOptions {
  /**
   * Snapshot the registered command catalog at query time — pass
   * `() => usePalette.getState().registered` so the provider sees commands
   * registered after it was constructed.
   */
  getRegistered: () => Record<string, Command>;
  /** Which groups to surface (`ALL_GROUPS` in agent mode, `CHAT_GROUPS` in chat). */
  groupFilter: CommandGroupFilter;
  /** Optional hook before a command runs (e.g. close an open composer panel). */
  onRun?: (cmd: Command) => void;
}

export function makeCommandProvider(
  opts: MakeCommandProviderOptions,
): AutocompleteProvider<CommandItem> {
  return {
    triggerChar: "/",
    getItems(query) {
      void query; // filtering/ranking is the engine's job (substring + MRU)
      return Object.values(opts.getRegistered())
        .filter((cmd) => !EXCLUDED_IDS.has(cmd.id) && opts.groupFilter(cmd.group))
        .map((cmd) => ({
          id: cmd.id,
          label: cmd.label,
          mruScore: 0, // P1: substring + alphabetical; a command MRU store is later
          command: cmd,
        }));
    },
    renderItem(item, { highlighted, onChoose }) {
      const Icon = item.command.icon;
      return (
        <button
          type="button"
          role="option"
          aria-selected={highlighted}
          data-testid={`command-option-${item.id}`}
          // mousedown (not click) so the input does not blur first
          onMouseDown={(e) => {
            e.preventDefault();
            onChoose(item);
          }}
          className={cn(
            "flex min-h-7 w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-ui focus-visible:outline-none",
            highlighted ? "bg-accent text-foreground" : "text-foreground hover:bg-accent",
          )}
        >
          {Icon ? (
            <Icon
              className="size-3.5 shrink-0 text-muted-foreground"
              strokeWidth={1.6}
              aria-hidden
            />
          ) : (
            <span className="size-3.5 shrink-0" aria-hidden />
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-baseline gap-1.5">
              <span className="truncate">{item.label}</span>
              {item.command.argHint ? (
                <span className="font-mono text-[11px] text-muted-foreground">
                  {item.command.argHint}
                </span>
              ) : null}
            </span>
            {item.command.description ? (
              <span className="truncate text-[11px] text-muted-foreground">
                {item.command.description}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {item.command.group}
          </span>
        </button>
      );
    },
    onSelect(item, token, bufferText) {
      // Excise the `/query` token; the command is the action, not inserted text.
      const before = bufferText.slice(0, token.start);
      const after = bufferText.slice(token.end);
      return {
        text: before + after,
        caret: token.start,
        sideEffect: () => {
          opts.onRun?.(item.command);
          item.command.run();
        },
      };
    },
  };
}
