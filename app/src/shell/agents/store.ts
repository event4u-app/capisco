import { create } from "zustand";

import { mockAgentProvider } from "@/mocks";
import type { Session } from "@/contracts";

/** Per-agent-run lifecycle state (drives loading / error / ready transcripts). */
export type RunState = "ready" | "loading" | "error";

interface AgentsState {
  /** Sessions appended at runtime by the new-session menu. */
  extra: Session[];
  /** Ids of sessions the user has closed. */
  closed: string[];
  activeId: string;
  /** Per-session run lifecycle (default ready; new sessions start empty/ready). */
  runStates: Record<string, RunState>;

  // Composer.
  model: string;
  effort: number;

  // Backend settings popover.
  backendKind: "api" | "cli";
  settingsOpen: boolean;

  setActive: (id: string) => void;
  createSession: (model: string) => void;
  closeSession: (id: string) => void;
  setModel: (model: string) => void;
  setEffort: (effort: number) => void;
  setBackendKind: (kind: "api" | "cli") => void;
  setRunState: (id: string, run: RunState) => void;
  setSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;
}

const base = mockAgentProvider.listSessions();

export const useAgents = create<AgentsState>((set) => ({
  extra: [],
  closed: [],
  activeId: base[0]?.id ?? "",
  runStates: {},

  model: "Opus 4.8",
  effort: 3,
  backendKind: "api",
  settingsOpen: false,

  setActive: (activeId) => set({ activeId }),

  createSession: (model) =>
    set((s) => {
      const id = `n${s.extra.length + 1}`;
      const session: Session = {
        id,
        // Use the leading word of the agent label as the compact model tag.
        model: model.split(" ")[0],
        status: "idle",
        title: "New session",
        meta: "idle",
      };
      return { extra: [...s.extra, session], activeId: id };
    }),

  closeSession: (id) =>
    set((s) => {
      const all = [...base, ...s.extra].filter((x) => !s.closed.includes(x.id));
      const remaining = all.filter((x) => x.id !== id);
      const nextActive = s.activeId === id && remaining.length ? remaining[0].id : s.activeId;
      return {
        extra: s.extra.filter((x) => x.id !== id),
        closed: s.closed.includes(id) ? s.closed : [...s.closed, id],
        activeId: nextActive,
      };
    }),

  setModel: (model) => set({ model }),
  setEffort: (effort) => set({ effort }),
  setBackendKind: (backendKind) => set({ backendKind }),
  setRunState: (id, run) => set((s) => ({ runStates: { ...s.runStates, [id]: run } })),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
}));

/** Resolves the visible session list from the base mock + runtime additions. */
export function visibleSessions(extra: Session[], closed: string[]): Session[] {
  return [...base, ...extra].filter((s) => !closed.includes(s.id));
}
