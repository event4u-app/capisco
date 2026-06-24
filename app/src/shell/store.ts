import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WorkspaceMode = "agents" | "chat" | "editor" | "git" | "tasks" | "diff";

/** The four dockable rail groups. The terminal toggle is itself a draggable
 * item (`TERMINAL_ID`) that lives in one of the left groups, so its position
 * sets the top/bottom split boundary — exactly as in the prototype. */
export type RailGroup = "leftTop" | "leftBottom" | "rightTop" | "rightBottom";

export const TERMINAL_ID = "__terminal__";

/** Stable ids for every dockable tool (build-spec §2 / chrome.jsx TOOLS). */
export const TOOL_IDS = [
  "explorer",
  "changes",
  "commit",
  "pr",
  "tasks",
  "search",
  "structure",
  "data",
  "services",
  "alerts",
  "inspect",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

/** Right-rail tools that behave as flyouts (overlay-by-default, pinnable) —
 * the shared signal surface views (R6 §2). */
export const FLYOUT_TOOL_IDS: readonly string[] = ["alerts", "inspect"];

export function isFlyoutTool(id: string | null): boolean {
  return id != null && FLYOUT_TOOL_IDS.includes(id);
}

/** Resolves the single active UNPINNED right-rail flyout (if any) for overlay
 * rendering. Pinned flyouts dock via the normal right panel stack instead. */
export function useActiveOverlayFlyout(): "alerts" | "inspect" | null {
  return useLayout((s) => {
    for (const id of [s.rTopActive, s.rBotActive]) {
      if ((id === "alerts" || id === "inspect") && !s.pinnedFlyouts.includes(id)) return id;
    }
    return null;
  });
}

export interface RailGroups {
  leftTop: string[];
  leftBottom: string[];
  rightTop: string[];
  rightBottom: string[];
}

const DEFAULT_GROUPS: RailGroups = {
  leftTop: [
    "explorer",
    "changes",
    "commit",
    "pr",
    "tasks",
    "search",
    "structure",
    "data",
    "services",
  ],
  leftBottom: [TERMINAL_ID],
  rightTop: ["alerts", "inspect"],
  rightBottom: [],
};

const GROUP_KEYS: RailGroup[] = ["leftTop", "leftBottom", "rightTop", "rightBottom"];

export type PresetId = "default" | "po";

interface LayoutState {
  mode: WorkspaceMode;
  /** Mode to return to when the diff view closes (build-spec §2: Close → prior mode). */
  previousMode: WorkspaceMode;
  setMode: (mode: WorkspaceMode) => void;

  // Rail groups + per-group active selection.
  groups: RailGroups;
  topActive: string | null;
  botActive: string | null;
  rTopActive: string | null;
  rBotActive: string | null;

  // Terminal.
  terminalOpen: boolean;
  toggleTerminal: () => void;
  terminalHeight: number;
  setTerminalHeight: (h: number) => void;

  // Split ratios (top/bottom within a rail's panel column), persisted.
  leftSplit: number;
  rightSplit: number;
  setLeftSplit: (r: number) => void;
  setRightSplit: (r: number) => void;

  // Presets / visibility (§5.4): hidden ≠ disabled — still reachable via palette.
  hiddenTools: string[];
  activePreset: PresetId | null;
  toggleToolVisibility: (id: string) => void;
  applyPreset: (preset: PresetId) => void;

  // Flyout pin state (R6 §2): a right-rail flyout tool (alerts / inspect) is
  // an unpinned OVERLAY by default (closes on a workspace click); pinning it
  // docks it as a column so the center shrinks. Pin is per-tool.
  pinnedFlyouts: string[];
  togglePin: (id: string) => void;

  // Actions.
  select: (id: string) => void;
  reorder: (dragId: string, group: RailGroup, beforeId: string | null) => void;
}

interface PresetDef {
  id: PresetId;
  labelKey: string;
  groups: RailGroups;
  hiddenTools: string[];
}

/** PO preset (§5.4 example): Dashboard / Tickets / PR — no editor/debugger tools. */
export const PRESETS: PresetDef[] = [
  {
    id: "default",
    labelKey: "preset.default",
    groups: DEFAULT_GROUPS,
    hiddenTools: [],
  },
  {
    id: "po",
    labelKey: "preset.po",
    groups: {
      leftTop: ["pr", "tasks", "changes"],
      leftBottom: [TERMINAL_ID],
      rightTop: ["alerts"],
      rightBottom: [],
    },
    // Editor-/debugger-leaning tools hidden — still findable via the palette.
    hiddenTools: ["explorer", "commit", "search", "structure", "data", "services", "inspect"],
  },
];

type ActiveKey = "topActive" | "botActive" | "rTopActive" | "rBotActive";

function activeKeyForGroup(group: RailGroup): ActiveKey {
  switch (group) {
    case "leftTop":
      return "topActive";
    case "leftBottom":
      return "botActive";
    case "rightTop":
      return "rTopActive";
    case "rightBottom":
      return "rBotActive";
  }
}

function cloneGroups(g: RailGroups): RailGroups {
  return {
    leftTop: [...g.leftTop],
    leftBottom: [...g.leftBottom],
    rightTop: [...g.rightTop],
    rightBottom: [...g.rightBottom],
  };
}

// Persisted layout state (build-spec §8: mode / terminal height / split ratios /
// rail order / visibility survive reload).
export const useLayout = create<LayoutState>()(
  persist(
    (set) => ({
      mode: "agents",
      previousMode: "agents",
      setMode: (mode) =>
        set((s) => {
          // Entering diff: remember the mode we came from (unless already in diff).
          if (mode === "diff" && s.mode !== "diff") return { mode, previousMode: s.mode };
          return { mode };
        }),

      groups: cloneGroups(DEFAULT_GROUPS),
      // Default shell is the centered placeholder (no panel open); clicking a
      // rail tool opens its panel. Keeps the Phase-0 golden valid.
      topActive: null,
      botActive: null,
      rTopActive: null,
      rBotActive: null,

      terminalOpen: false,
      toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
      terminalHeight: 220,
      setTerminalHeight: (terminalHeight) => set({ terminalHeight }),

      leftSplit: 0.5,
      rightSplit: 0.5,
      setLeftSplit: (leftSplit) => set({ leftSplit }),
      setRightSplit: (rightSplit) => set({ rightSplit }),

      pinnedFlyouts: [],
      togglePin: (id) =>
        set((s) => ({
          pinnedFlyouts: s.pinnedFlyouts.includes(id)
            ? s.pinnedFlyouts.filter((x) => x !== id)
            : [...s.pinnedFlyouts, id],
        })),

      hiddenTools: [],
      activePreset: "default",
      toggleToolVisibility: (id) =>
        set((s) => ({
          activePreset: null,
          hiddenTools: s.hiddenTools.includes(id)
            ? s.hiddenTools.filter((x) => x !== id)
            : [...s.hiddenTools, id],
        })),
      applyPreset: (presetId) =>
        set(() => {
          const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
          return {
            groups: cloneGroups(preset.groups),
            hiddenTools: [...preset.hiddenTools],
            activePreset: preset.id,
            topActive: null,
            botActive: null,
            rTopActive: null,
            rBotActive: null,
          };
        }),

      select: (id) =>
        set((s) => {
          for (const group of GROUP_KEYS) {
            if (s.groups[group].includes(id)) {
              const key = activeKeyForGroup(group);
              return { [key]: s[key] === id ? null : id } as Partial<LayoutState>;
            }
          }
          return {};
        }),

      reorder: (dragId, group, beforeId) =>
        set((s) => {
          // Remove dragId from every group, then insert into the target group.
          const next: RailGroups = {
            leftTop: s.groups.leftTop.filter((x) => x !== dragId),
            leftBottom: s.groups.leftBottom.filter((x) => x !== dragId),
            rightTop: s.groups.rightTop.filter((x) => x !== dragId),
            rightBottom: s.groups.rightBottom.filter((x) => x !== dragId),
          };
          const arr = next[group];
          if (beforeId == null || arr.indexOf(beforeId) < 0) arr.push(dragId);
          else arr.splice(arr.indexOf(beforeId), 0, dragId);

          const wasActive = [s.topActive, s.botActive, s.rTopActive, s.rBotActive].includes(
            dragId,
          );
          const result: Partial<LayoutState> = {
            groups: next,
            activePreset: null,
            topActive: next.leftTop.includes(s.topActive ?? "") ? s.topActive : null,
            botActive: next.leftBottom.includes(s.botActive ?? "") ? s.botActive : null,
            rTopActive: next.rightTop.includes(s.rTopActive ?? "") ? s.rTopActive : null,
            rBotActive: next.rightBottom.includes(s.rBotActive ?? "") ? s.rBotActive : null,
          };
          // A dragged-while-active tool stays active in its new group.
          if (wasActive && dragId !== TERMINAL_ID) {
            result[activeKeyForGroup(group)] = dragId;
          }
          return result;
        }),
    }),
    {
      name: "capisco-layout",
      version: 3,
      partialize: (s) => ({
        mode: s.mode,
        previousMode: s.previousMode,
        groups: s.groups,
        topActive: s.topActive,
        botActive: s.botActive,
        rTopActive: s.rTopActive,
        rBotActive: s.rBotActive,
        terminalOpen: s.terminalOpen,
        terminalHeight: s.terminalHeight,
        leftSplit: s.leftSplit,
        rightSplit: s.rightSplit,
        hiddenTools: s.hiddenTools,
        activePreset: s.activePreset,
        pinnedFlyouts: s.pinnedFlyouts,
      }),
    },
  ),
);
