/**
 * Saved-prompts `/`-autocomplete provider (composer-intelligence S9). A SECOND
 * provider on the `/` trigger — it co-exists with the command provider via the
 * multi-provider merge (P2 `collectProviders`), so `/` surfaces saved prompt
 * templates alongside commands. Selecting one FILLS the composer with the body
 * (never auto-sends — the same discipline as `@`-mentions and the P3 empty-state).
 *
 * Sources ONLY explicitly-saved templates (`savedPrompts`) — recent sends are
 * reached via ↑-recall / the Cmd+R history overlay, so the `/` list stays a
 * curated set. Empty by default → the provider returns nothing → the `/` overlay
 * is byte-identical to the command-only list (golden-safe).
 */

import { FileText } from "lucide-react";

import type { SavedPrompt } from "@/shell/agents/store";
import { cn } from "@/lib/utils";
import type { AutocompleteItem, AutocompleteProvider } from "../types";

export interface SavedPromptItem extends AutocompleteItem {
  prompt: SavedPrompt;
}

export interface MakeSavedPromptsProviderOptions {
  /** Snapshot the saved-prompt list at query time (store selector). */
  getSaved: () => SavedPrompt[];
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function makeSavedPromptsProvider(
  opts: MakeSavedPromptsProviderOptions,
): AutocompleteProvider<SavedPromptItem> {
  return {
    triggerChar: "/",
    getItems(query) {
      void query; // engine does substring + MRU ranking
      return opts.getSaved().map((prompt) => ({
        id: `saved:${prompt.id}`,
        label: prompt.label,
        mruScore: 0,
        prompt,
      }));
    },
    renderItem(item, { highlighted, onChoose }) {
      return (
        <button
          type="button"
          role="option"
          aria-selected={highlighted}
          data-testid={`saved-prompt-option-${item.prompt.id}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onChoose(item);
          }}
          className={cn(
            "flex min-h-7 w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-ui focus-visible:outline-none",
            highlighted ? "bg-accent text-foreground" : "text-foreground hover:bg-accent",
          )}
        >
          <FileText
            className="size-3.5 shrink-0 text-muted-foreground"
            strokeWidth={1.6}
            aria-hidden
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">{item.label}</span>
            <span className="truncate text-[11px] text-muted-foreground">
              {clip(item.prompt.body, 80)}
            </span>
          </span>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
            saved
          </span>
        </button>
      );
    },
    onSelect(item, token, bufferText) {
      // Fill: replace the `/query` token with the template body; caret to end of
      // the inserted body. NEVER sends — the user reviews before sending.
      const before = bufferText.slice(0, token.start);
      const after = bufferText.slice(token.end);
      const text = before + item.prompt.body + after;
      return { text, caret: (before + item.prompt.body).length };
    },
  };
}
