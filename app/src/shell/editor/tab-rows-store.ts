import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Editor tab-strip row count (Design-Sync P1). 1 = single-row horizontal
 * scroll (default); 2/3 = multi-row wrap. Persisted across reloads under the
 * prototype's `capisco-tabrows` key so the choice survives. */
export type TabRows = 1 | 2 | 3;

interface TabRowsState {
  rows: TabRows;
  setRows: (rows: TabRows) => void;
}

export const useTabRows = create<TabRowsState>()(
  persist(
    (set) => ({
      rows: 1,
      setRows: (rows) => set({ rows }),
    }),
    {
      name: "capisco-tabrows",
      // Persist the bare number under the legacy prototype key shape; the store
      // default (1) keeps CI / Playwright goldens unaffected (no stored value).
      partialize: (s) => ({ rows: s.rows }),
    },
  ),
);
