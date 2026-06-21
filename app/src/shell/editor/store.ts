import { create } from "zustand";
import { mockEditorProvider } from "@/mocks";

export interface EditorTabState {
  /** Stable id / file path. */
  file: string;
  ext: string;
  /** Display label (rename overrides the file's basename). */
  label: string;
  pinned: boolean;
  dirty: boolean;
}

interface EditorStore {
  tabs: EditorTabState[];
  activeFile: string;
  setActive: (file: string) => void;
  closeTab: (file: string) => void;
  togglePin: (file: string) => void;
  rename: (file: string, label: string) => void;
  /** Move `dragFile` to sit before `beforeFile` (or to the end when null). */
  reorder: (dragFile: string, beforeFile: string | null) => void;
}

function initialTabs(): EditorTabState[] {
  return mockEditorProvider.getDocs().map((d) => ({
    file: d.file,
    ext: d.ext,
    label: d.file,
    pinned: !!d.pinned,
    dirty: !!d.dirty,
  }));
}

const TABS = initialTabs();

/**
 * Editor tab-strip state (roadmap Phase 0): pinnable, drag-reorder, dirty
 * indicator, double-click rename. Deterministic init from the mock provider.
 */
export const useEditor = create<EditorStore>((set) => ({
  tabs: TABS,
  activeFile: TABS[0]?.file ?? "",
  setActive: (file) => set({ activeFile: file }),
  closeTab: (file) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.file === file);
      const tabs = s.tabs.filter((t) => t.file !== file);
      let activeFile = s.activeFile;
      if (s.activeFile === file) {
        const next = tabs[idx] ?? tabs[idx - 1] ?? tabs[0];
        activeFile = next?.file ?? "";
      }
      return { tabs, activeFile };
    }),
  togglePin: (file) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.file === file ? { ...t, pinned: !t.pinned } : t)),
    })),
  rename: (file, label) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.file === file ? { ...t, label } : t)),
    })),
  reorder: (dragFile, beforeFile) =>
    set((s) => {
      const drag = s.tabs.find((t) => t.file === dragFile);
      if (!drag) return {};
      const rest = s.tabs.filter((t) => t.file !== dragFile);
      const idx = beforeFile == null ? rest.length : rest.findIndex((t) => t.file === beforeFile);
      const at = idx < 0 ? rest.length : idx;
      return { tabs: [...rest.slice(0, at), drag, ...rest.slice(at)] };
    }),
}));
