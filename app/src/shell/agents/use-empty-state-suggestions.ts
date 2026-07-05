/**
 * Empty-State suggestions hook (composer-intelligence P3). Resolves the four
 * SYNCHRONOUS sources and memoizes the pure builder. Every source is a
 * synchronous read (the P4 prompt-log map + the deterministic `editorSnapshot`
 * and `mockCurrentBranch` / `mockChangeSet` facades) so the first paint already
 * carries the final rows — no `useEffect` + async fetch, no boot flicker.
 */

import { useMemo } from "react";

import { editorSnapshot } from "@/mocks/editor";
import { mockChangeSet, mockCurrentBranch } from "@/mocks/workspace";
import { buildEmptyStateSuggestions, type Suggestion } from "./empty-state-suggestions";

export interface UseEmptyStateSuggestionsOpts {
  /** The per-session prompt-log map (P4), subscribed by the workspace. */
  promptLogs: Record<string, string[]>;
  /** Active session id. */
  sessionId: string;
  /** Chat surface (no tools) → file/git rows suppressed. */
  isChat: boolean;
}

export function useEmptyStateSuggestions({
  promptLogs,
  sessionId,
  isChat,
}: UseEmptyStateSuggestionsOpts): Suggestion[] {
  const log = promptLogs[sessionId];
  return useMemo(() => {
    // Most-recent-FIRST, last 3 — mirrors `recentPrompts` (store.ts) semantics.
    const recent = (log ?? []).slice(-3).reverse();
    return buildEmptyStateSuggestions({
      recentPrompts: recent,
      editorDocs: editorSnapshot.getDocs(),
      currentBranch: mockCurrentBranch,
      changedFileCount: mockChangeSet.files.length,
      isChat,
    });
    // `log` is the array reference — changes only when a prompt is appended.
  }, [log, isChat]);
}
