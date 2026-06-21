import * as React from "react";
import { create } from "zustand";
import type { LucideIcon } from "lucide-react";

export interface Command {
  id: string;
  /** i18n key OR pre-resolved label (resolved at registration time). */
  label: string;
  group: "modes" | "tools" | "view" | "presets";
  icon?: LucideIcon;
  /** Keywords to widen fuzzy matching (e.g. for hidden tools). */
  keywords?: string;
  run: () => void;
}

interface PaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** Dynamically registered commands keyed by id (the escalation ladder: any
   * feature can register itself so it stays findable even when hidden). */
  registered: Record<string, Command>;
  register: (cmd: Command) => () => void;
}

/**
 * Command-palette registry (build-spec §5.6.6). Built-in commands are derived
 * from the layout store inside the palette component; this store also accepts
 * dynamically registered commands so later roadmaps' actions self-register.
 */
export const usePalette = create<PaletteState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  registered: {},
  register: (cmd) => {
    set((s) => ({ registered: { ...s.registered, [cmd.id]: cmd } }));
    return () => {
      const next = { ...get().registered };
      delete next[cmd.id];
      set({ registered: next });
    };
  },
}));

/** Registers the global palette shortcut (Cmd/Ctrl-K and Cmd/Ctrl-Shift-P). */
export function usePaletteShortcut() {
  const toggle = usePalette((s) => s.toggle);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        toggle();
      } else if (mod && e.shiftKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
}
