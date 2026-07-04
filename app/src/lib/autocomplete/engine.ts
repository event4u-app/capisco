/**
 * Shared autocomplete engine (road-to-composer-intelligence P0). ONE hook owns
 * all overlay state + the keyboard for any textarea/input — providers supply
 * data + rendering + selection only. This single ownership is what makes the
 * "`@` breaks after `/`" bug class structurally impossible: one tokenizer, one
 * dispatch, one keyboard handler.
 *
 * Invariants (Querschnitts-Invariante Design-Fidelity):
 *  - The overlay opens strictly on a state-transition (a trigger keypress),
 *    never on mount → the composer pixel-goldens stay intact.
 *  - Stale async `getItems` results are dropped via a generation counter.
 *  - Arrow/Enter/Tab/Esc are intercepted ONLY while the overlay is open;
 *    every other key (and all keys while closed) passes through unchanged.
 *  - `onSelect` insertion is applied synchronously; the opt-in side-effect is
 *    scheduled after and never gates the insertion.
 */

import * as React from "react";
import { detectToken, type ActiveToken, type TriggerChar } from "@/lib/mention/token-detector";
import { filterAndRank } from "./filter";
import type { AutocompleteItem, AutocompleteProvider } from "./types";

export type MentionFieldElement = HTMLInputElement | HTMLTextAreaElement;

export interface AutocompleteEngineOptions {
  /** Enable fuzzy re-rank (substring stays the floor). Default false. */
  fuzzy?: boolean;
  /** Called before each query — e.g. to lazy-load a provider's data source. */
  onBeforeQuery?: () => void;
  /** The host's own `onKeyDown`, invoked for every key the engine does not consume. */
  onKeyDownPassthrough?: (e: React.KeyboardEvent<MentionFieldElement>) => void;
}

export interface AutocompleteEngine<T extends AutocompleteItem> {
  open: boolean;
  items: T[];
  highlight: number;
  token: ActiveToken | null;
  provider: AutocompleteProvider<T> | null;
  choose: (item: T) => void;
  inputProps: {
    onKeyDown: (e: React.KeyboardEvent<MentionFieldElement>) => void;
    onInput: () => void;
    onClick: () => void;
    role: "combobox";
    "aria-autocomplete": "list";
    "aria-expanded": boolean;
    "aria-controls": string | undefined;
  };
}

export function useAutocompleteEngine<T extends AutocompleteItem>(
  ref: React.RefObject<MentionFieldElement | null>,
  providers: AutocompleteProvider<T>[],
  options?: AutocompleteEngineOptions,
): AutocompleteEngine<T> {
  const [token, setToken] = React.useState<ActiveToken | null>(null);
  const [items, setItems] = React.useState<T[]>([]);
  const [highlight, setHighlight] = React.useState(0);
  const genRef = React.useRef(0);

  const fuzzy = options?.fuzzy;
  const onBeforeQuery = options?.onBeforeQuery;
  const passthrough = options?.onKeyDownPassthrough;

  const pickProvider = React.useCallback(
    (trigger: TriggerChar): AutocompleteProvider<T> | null =>
      providers.find((p) => p.triggerChar === trigger) ?? null,
    [providers],
  );

  const runQuery = React.useCallback(
    (tok: ActiveToken | null) => {
      if (!tok) {
        setItems([]);
        return;
      }
      const prov = pickProvider(tok.trigger);
      if (!prov) {
        setItems([]);
        return;
      }
      onBeforeQuery?.();
      const gen = ++genRef.current;
      void Promise.resolve(prov.getItems(tok.query)).then((raw) => {
        if (gen !== genRef.current) return; // stale result, dropped
        setItems(filterAndRank(raw, tok.query, { fuzzy }));
        setHighlight(0);
      });
    },
    [pickProvider, onBeforeQuery, fuzzy],
  );

  const refresh = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const tok = detectToken(el.value, el.selectionStart ?? el.value.length);
    setToken(tok);
    runQuery(tok);
  }, [ref, runQuery]);

  // Re-query when the provider set changes while a token is active (e.g. a
  // provider's data source finished loading lazily). Deferred to a microtask so
  // the re-query never setStates synchronously inside the effect.
  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) runQuery(token);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers]);

  const open = token !== null && items.length > 0;
  const provider = token ? pickProvider(token.trigger) : null;

  const close = React.useCallback(() => {
    setToken(null);
    setItems([]);
  }, []);

  const choose = React.useCallback(
    (item: T) => {
      const el = ref.current;
      if (el && token) {
        const prov = pickProvider(token.trigger);
        if (prov) {
          const res = prov.onSelect(item, token, el.value);
          el.value = res.text;
          el.setSelectionRange(res.caret, res.caret);
          if (res.sideEffect) void Promise.resolve().then(res.sideEffect);
        }
      }
      close();
      ref.current?.focus();
    },
    [ref, token, pickProvider, close],
  );

  const onKeyDown = (e: React.KeyboardEvent<MentionFieldElement>) => {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % items.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + items.length) % items.length);
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        choose(items[highlight] ?? items[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
    }
    passthrough?.(e);
  };

  return {
    open,
    items,
    highlight,
    token,
    provider,
    choose,
    inputProps: {
      onKeyDown,
      onInput: refresh,
      onClick: refresh,
      role: "combobox",
      "aria-autocomplete": "list",
      "aria-expanded": open,
      "aria-controls": open ? "mention-listbox" : undefined,
    },
  };
}
