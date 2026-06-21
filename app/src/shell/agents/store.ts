import { create } from "zustand";
import { persist } from "zustand/middleware";

import { agentSnapshot } from "@/mocks";
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
  /** Selected agent backend id (B8 P3) — persisted; default the deterministic stub. */
  selectedBackendId: string;

  setActive: (id: string) => void;
  createSession: (model: string) => void;
  closeSession: (id: string) => void;
  setModel: (model: string) => void;
  setEffort: (effort: number) => void;
  setBackendKind: (kind: "api" | "cli") => void;
  setSelectedBackend: (id: string) => void;
  setRunState: (id: string, run: RunState) => void;
  setSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;
}

const base = agentSnapshot.sessions;

export const useAgents = create<AgentsState>()(
  persist(
    (set) => ({
      extra: [],
      closed: [],
      activeId: base[0]?.id ?? "",
      runStates: {},

      model: "Opus 4.8",
      effort: 3,
      backendKind: "api",
      settingsOpen: false,
      selectedBackendId: agentSnapshot.defaultBackendId,

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
            // A fresh session has zero structured telemetry (Phase 1).
            telemetry: { tokensIn: 0, tokensOut: 0, runtimeMs: 0 },
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
      setSelectedBackend: (selectedBackendId) => set({ selectedBackendId }),
      setRunState: (id, run) => set((s) => ({ runStates: { ...s.runStates, [id]: run } })),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
    }),
    {
      name: "capisco-agents",
      // Persist ONLY the selected backend id — the rest of the store is
      // session-ephemeral (sessions, run states, popover open). Default stays
      // the deterministic stub so CI / Playwright goldens are unaffected.
      partialize: (s) => ({ selectedBackendId: s.selectedBackendId }),
    },
  ),
);

/** Resolves the visible session list from the base mock + runtime additions. */
export function visibleSessions(extra: Session[], closed: string[]): Session[] {
  return [...base, ...extra].filter((s) => !closed.includes(s.id));
}

/**
 * Render structured run telemetry into the compact tab/subagent meta string
 * (Phase 1 — replaces the pre-rendered `meta`). For a running session it shows
 * runtime + output tokens (e.g. "2m 49s · 6.5k ↓"); idle/waiting sessions with
 * no runtime fall back to the status word. Volatile — masked in goldens.
 */
export function formatTelemetry(
  telemetry: { tokensIn: number; tokensOut: number; runtimeMs: number },
  status: Session["status"],
): string {
  if (telemetry.runtimeMs === 0) {
    if (status === "waiting") return "waiting";
    return telemetry.tokensOut > 0
      ? `idle · ${formatTokens(telemetry.tokensOut)} ↓`
      : "idle";
  }
  const totalSec = Math.round(telemetry.runtimeMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const time = `${m}m ${String(s).padStart(2, "0")}s`;
  return `${time} · ${formatTokens(telemetry.tokensOut)} ↓`;
}

function formatTokens(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return String(n);
}
