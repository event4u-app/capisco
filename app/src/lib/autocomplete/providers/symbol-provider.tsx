/**
 * `@symbol` autocomplete provider (road-to-composer-intelligence P2, leer-aber-stabil).
 * Returns an empty list today — the real symbol fetch is a later gated slice.
 * The provider is LSP-gated: it only proceeds when a language server is available
 * for the configured language. In the current state (no LSP wired) it is always
 * stable and never throws.
 */

import { Hash } from "lucide-react";
import { getProviders } from "@/lib/desktop-shell";
import { cn } from "@/lib/utils";
import type { AutocompleteItem, AutocompleteProvider } from "../types";

export interface SymbolItem extends AutocompleteItem {
  detail?: string;
}

export interface MakeSymbolProviderOptions {
  /** LSP languageId to check availability for. Defaults to "typescript". */
  languageId?: string;
}

export function makeSymbolProvider(
  opts?: MakeSymbolProviderOptions,
): AutocompleteProvider<SymbolItem> {
  return {
    triggerChar: "@",

    async getItems(query) {
      void query; // filtering is the engine's job; this provider returns [] today
      const ok = await getProviders().lsp.available(opts?.languageId ?? "typescript");
      if (!ok) return [];
      // TODO(P2-tail): query real symbols via lsp when available
      return [];
    },

    renderItem(item, { highlighted, onChoose }) {
      return (
        <button
          type="button"
          role="option"
          aria-selected={highlighted}
          data-testid={`symbol-option-${item.label}`}
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
          <Hash className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.6} />
          <span className="flex-1 truncate">{item.label}</span>
          {item.detail ? (
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
              {item.detail}
            </span>
          ) : null}
        </button>
      );
    },

    onSelect(item, token, bufferText) {
      const insert = `@${item.label} `;
      const before = bufferText.slice(0, token.start);
      const after = bufferText.slice(token.end);
      return {
        text: before + insert + after,
        caret: token.start + insert.length,
      };
    },
  };
}
