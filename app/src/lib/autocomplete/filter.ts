/**
 * Shared filter + rank for the autocomplete engine (road-to-composer-intelligence
 * P0, S11 MRU + S12 fuzzy). Every provider inherits this — there is no
 * per-provider ranking, so behavior is uniform across `@`/`/`/`@file`.
 *
 * Substring is the floor (Council caveat: short lists must not get a
 * ranking-surprise bug); MRU orders the survivors; fuzzy is an opt-in secondary
 * re-rank that never surfaces a non-substring item. Pure + deterministic.
 */

import type { AutocompleteItem, TaggedItem } from "./types";

export interface FilterOptions {
  /** Enable fuzzy re-rank as a secondary key. Default false (substring + MRU only). */
  fuzzy?: boolean;
}

/**
 * fzf-style score: rewards contiguous in-order character matches, tolerates
 * gaps. Returns 0 when `query` is not a subsequence of `label`. Intentionally
 * minimal — the candidate lists are short (< ~50), a full fzf port is overkill.
 */
export function fuzzyScore(label: string, query: string): number {
  const l = label.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;
  let li = 0;
  let contiguous = 0;
  for (const qch of q) {
    const found = l.indexOf(qch, li);
    if (found === -1) return 0;
    if (found === li) {
      contiguous += 1;
      score += 2 + contiguous;
    } else {
      contiguous = 0;
      score += 1;
    }
    li = found + 1;
  }
  return score;
}

/**
 * Filter to substring matches (empty query passes all → Top-Picks), then sort
 * MRU-descending, then optional fuzzy score, then label alphabetical (stable).
 */
export function filterAndRank<T extends AutocompleteItem>(
  items: T[],
  query: string,
  options?: FilterOptions,
): T[] {
  const q = query.trim().toLowerCase();
  const filtered =
    q === "" ? items.slice() : items.filter((it) => it.label.toLowerCase().includes(q));

  filtered.sort((a, b) => {
    const mru = b.mruScore - a.mruScore;
    if (mru !== 0) return mru;
    if (options?.fuzzy && q !== "") {
      const fa = fuzzyScore(a.label, q);
      const fb = fuzzyScore(b.label, q);
      if (fa !== fb) return fb - fa;
    }
    return a.label.localeCompare(b.label);
  });

  return filtered;
}

/**
 * Same filter+rank as {@link filterAndRank}, but over `TaggedItem`s from
 * multiple providers sharing a trigger — items rank against each other by the
 * same rules (substring floor, MRU, optional fuzzy), regardless of which
 * provider produced them.
 */
export function filterAndRankTagged<T extends AutocompleteItem>(
  tagged: TaggedItem<T>[],
  query: string,
  options?: FilterOptions,
): TaggedItem<T>[] {
  const q = query.trim().toLowerCase();
  const filtered =
    q === "" ? tagged.slice() : tagged.filter((ti) => ti.item.label.toLowerCase().includes(q));

  filtered.sort((a, b) => {
    const mru = b.item.mruScore - a.item.mruScore;
    if (mru !== 0) return mru;
    if (options?.fuzzy && q !== "") {
      const fa = fuzzyScore(a.item.label, q);
      const fb = fuzzyScore(b.item.label, q);
      if (fa !== fb) return fb - fa;
    }
    return a.item.label.localeCompare(b.item.label);
  });

  return filtered;
}
