/**
 * Autocomplete engine types (road-to-composer-intelligence P0). A provider
 * teaches the shared engine what to show for one trigger; it is pure data +
 * render — it NEVER owns the textarea, the caret, the keyboard, or the overlay.
 * That single ownership boundary is what keeps multiple providers (`@project`,
 * `/command`, `@file`) from forking the caret/keyboard logic.
 */

import type { ReactNode } from "react";
import type { ActiveToken, TriggerChar } from "@/lib/mention/token-detector";

/** The minimal shape every autocomplete item satisfies; providers extend it. */
export interface AutocompleteItem {
  /** Stable identity for React keys + selection. */
  id: string;
  /** Primary label, substring-matched against the query. */
  label: string;
  /** MRU ordinal (higher = more recent/frequent); 0 = no preference. */
  mruScore: number;
}

/** Context the engine passes to a provider's `renderItem`. */
export interface RenderItemContext<T extends AutocompleteItem> {
  highlighted: boolean;
  index: number;
  /** Accept this item (the engine applies the insertion + side-effect). */
  onChoose: (item: T) => void;
}

/** The mutation a provider's `onSelect` returns. */
export interface SelectResult {
  /** New buffer text after inserting the accepted item. */
  text: string;
  /** New caret position (just past the insertion). */
  caret: number;
  /**
   * Opt-in side-effect run AFTER the textarea mutation — never blocks or gates
   * the insertion. `@project` opens the project here; a `/command` runs the
   * command; an `@file` attaches a chip. Omit for pure insertion.
   */
  sideEffect?: () => void | Promise<void>;
}

/** Teaches the engine one trigger's items, rendering, and selection. */
export interface AutocompleteProvider<T extends AutocompleteItem = AutocompleteItem> {
  /** The trigger char this provider answers. */
  triggerChar: TriggerChar;
  /** Produce candidates for a query (sync or async; engine drops stale results). */
  getItems(query: string): T[] | Promise<T[]>;
  /** Render one item's content (engine owns the `<li>` wrapper + ARIA list). */
  renderItem(item: T, ctx: RenderItemContext<T>): ReactNode;
  /** Compute the buffer mutation when an item is accepted. */
  onSelect(item: T, token: ActiveToken, bufferText: string): SelectResult;
}

/**
 * An item paired with the provider that produced it. When several providers
 * share a trigger (e.g. `@project` + `@file` + `@symbol`), the engine merges
 * their items into one ranked list and carries each item's owning provider so
 * `renderItem` / `onSelect` dispatch per-item, not per-trigger.
 */
export interface TaggedItem<T extends AutocompleteItem = AutocompleteItem> {
  item: T;
  provider: AutocompleteProvider<T>;
}
