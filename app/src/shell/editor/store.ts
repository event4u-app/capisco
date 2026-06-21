import { create } from "zustand";
import { editorSnapshot } from "@/mocks";
import { useOpenProject } from "@/shell/open-project-store";

export interface EditorTabState {
  /** Stable id / file path. */
  file: string;
  ext: string;
  /** Display label (rename overrides the file's basename). */
  label: string;
  pinned: boolean;
  dirty: boolean;
}

/** A real-file document opened from disk (P1/P2) — content the editor renders. */
export interface RealDoc {
  file: string;
  ext: string;
  /** Current editor buffer text (edited live; the source CM6 indexes). */
  text: string;
  /** Last-saved-to-disk text. `dirty` is `text !== savedText`. */
  savedText: string;
}

/** The outcome of a {@link EditorStore.saveActive} attempt (P2). */
export interface SaveOutcome {
  /** True when the broker let the write reach disk. */
  written: boolean;
  /** The reason a gated/denied save did not write (audited gate reason). */
  reason?: string;
}

interface EditorStore {
  tabs: EditorTabState[];
  activeFile: string;
  /**
   * Content of files opened from the REAL project (P1), keyed by tab id. The
   * editor prefers this over the mock snapshot when present, so a real-opened
   * file shows its real content. Empty in the mock/visual harness.
   */
  realDocs: Record<string, RealDoc>;
  setActive: (file: string) => void;
  closeTab: (file: string) => void;
  togglePin: (file: string) => void;
  rename: (file: string, label: string) => void;
  /** Move `dragFile` to sit before `beforeFile` (or to the end when null). */
  reorder: (dragFile: string, beforeFile: string | null) => void;
  /**
   * Open a real file (already-read content) as a tab and activate it. Replaces
   * any existing tab with the same id so re-opening refreshes content.
   */
  openRealDoc: (doc: { file: string; ext: string; text: string }) => void;
  /**
   * Update the live buffer of a real doc as the user types (P2). Marks the tab
   * dirty when the buffer diverges from the last saved text.
   */
  setRealDocText: (file: string, text: string) => void;
  /**
   * Save the active real doc to disk through the broker-gated `projectFs.write`
   * path (P2). On a written save the tab clears dirty and the saved baseline
   * advances; on a gated/denied save nothing changes on disk and the tab stays
   * dirty. No-op (written:false) when the active file is not a real doc.
   */
  saveActive: () => Promise<SaveOutcome>;
}

function initialTabs(): EditorTabState[] {
  return editorSnapshot.getDocs().map((d) => ({
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
export const useEditor = create<EditorStore>((set, get) => ({
  tabs: TABS,
  activeFile: TABS[0]?.file ?? "",
  realDocs: {},
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
  openRealDoc: (doc) =>
    set((s) => {
      const tab: EditorTabState = {
        file: doc.file,
        ext: doc.ext,
        label: doc.file,
        pinned: false,
        dirty: false,
      };
      const tabs = s.tabs.some((t) => t.file === doc.file)
        ? s.tabs.map((t) => (t.file === doc.file ? tab : t))
        : [...s.tabs, tab];
      // Opening (re-)reads from disk: savedText === text, so the tab is clean.
      const real: RealDoc = { ...doc, savedText: doc.text };
      return { tabs, activeFile: doc.file, realDocs: { ...s.realDocs, [doc.file]: real } };
    }),
  setRealDocText: (file, text) =>
    set((s) => {
      const doc = s.realDocs[file];
      if (!doc || doc.text === text) return {};
      const next: RealDoc = { ...doc, text };
      return {
        realDocs: { ...s.realDocs, [file]: next },
        tabs: s.tabs.map((t) =>
          t.file === file ? { ...t, dirty: text !== doc.savedText } : t,
        ),
      };
    }),
  saveActive: async (): Promise<SaveOutcome> => {
    const { activeFile, realDocs } = get();
    const doc = realDocs[activeFile];
    // Only a real (opened-from-disk) doc is savable; the mock snapshot is not.
    if (!doc) return { written: false, reason: "not a real document" };

    const result = await useOpenProject.getState().writeFile(doc.file, doc.text);
    if (result.written) {
      // Disk now matches the buffer: advance the saved baseline + clear dirty.
      set((s) => {
        const cur = s.realDocs[doc.file];
        if (!cur) return {};
        return {
          realDocs: { ...s.realDocs, [doc.file]: { ...cur, savedText: doc.text } },
          tabs: s.tabs.map((t) =>
            t.file === doc.file ? { ...t, dirty: cur.text !== doc.text } : t,
          ),
        };
      });
    }
    return { written: result.written, reason: result.reason };
  },
}));
