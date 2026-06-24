import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist } from "zustand/middleware";

import { agentSnapshot, chatSnapshot } from "@/mocks";
import type { Session, TranscriptBlock } from "@/contracts";
import { buildSessionHandoff } from "./handoff";

/** Per-agent-run lifecycle state (drives loading / error / ready transcripts). */
export type RunState = "ready" | "loading" | "error";

/** Which workspace a store instance backs — `agents` (full: subagents +
 * tool-actions) or `chat` (quick chat · no tools). Design-Sync P3. */
export type WorkspaceKind = "agents" | "chat";

/** Caveman terse verbosity level (Phase 2) — mirrors the sidecar `TerseLevel`.
 * Defined UI-locally so the browser store never imports the node-only injector. */
export type TerseLevel = "lite" | "full" | "ultra";

interface AgentsState {
  /** Sessions appended at runtime by the new-session menu. */
  extra: Session[];
  /** Ids of sessions the user has closed. */
  closed: string[];
  activeId: string;
  /** Per-session run lifecycle (default ready; new sessions start empty/ready). */
  runStates: Record<string, RunState>;
  /**
   * Seed text per session id, set ONLY by a Red→new-session handoff (Phase 1):
   * the compressed carry-over summary of the session this one was handed off
   * from. The empty transcript renders it so the fresh session is not a blank
   * restart. Ephemeral (not persisted).
   */
  handoffSeeds: Record<string, string>;

  // Composer.
  model: string;
  effort: number;

  /**
   * Caveman terse mode (Phase 2, token-economy). Default ON, opt-out per
   * session; level lite/full/ultra. The composer control toggles it; the seam
   * to the agent backends injects the vendored directive into the system
   * context. PERSISTED (a session-scoped product preference). `terseHintSeen`
   * gates the one-time "this is intentional, not broken/rude" hint. */
  terseEnabled: boolean;
  terseLevel: TerseLevel;
  terseHintSeen: boolean;

  /**
   * Model-routing (Phase 4, token-economy / F5). DEFAULT OFF — it intervenes
   * non-deterministically in the result, so it is calibrated on real runs
   * before it silently swaps models. When on, a session's model is the
   * deterministic routing decision (by origin) unless the human overrode it.
   * PERSISTED (a product preference). `modelOverrides` is the per-session human
   * override (session id → forced model) — the human always wins. */
  routingEnabled: boolean;
  modelOverrides: Record<string, string>;

  /** Context-budget warn threshold in tokens (Design-Sync P4). The meter turns
   * green < 60% · orange < 85% · red otherwise of this budget. PURE projection:
   * setting it only moves the warning line; no behaviour is wired here (the
   * Rot-banner buttons are token-economy P2 stubs). Ephemeral (not persisted). */
  budget: number;

  // Backend settings popover.
  backendKind: "api" | "cli";
  settingsOpen: boolean;
  /** Selected agent backend id (B8 P3) — persisted; default the deterministic stub. */
  selectedBackendId: string;

  setActive: (id: string) => void;
  createSession: (model: string) => void;
  /**
   * Red→new-session handoff (Phase 1): create a fresh session seeded with a
   * COMPRESSED summary of `parent` (built from its transcript `blocks`), switch
   * to it, and record the seed for the empty-transcript view. Human-initiated
   * (the Rot-banner button) — never auto-fired. NEVER mutates the parent.
   * Returns the new session id.
   */
  handoffToNewSession: (parent: Session, blocks: TranscriptBlock[]) => string;
  closeSession: (id: string) => void;
  setModel: (model: string) => void;
  setEffort: (effort: number) => void;
  setBudget: (budget: number) => void;
  setTerseEnabled: (on: boolean) => void;
  setTerseLevel: (level: TerseLevel) => void;
  markTerseHintSeen: () => void;
  setRoutingEnabled: (on: boolean) => void;
  /** Per-session human override (the human always wins over routing). Empty string clears. */
  setModelOverride: (sessionId: string, model: string) => void;
  setBackendKind: (kind: "api" | "cli") => void;
  setSelectedBackend: (id: string) => void;
  setRunState: (id: string, run: RunState) => void;
  /** Cancel a session's run (P3 / B3): set it ready, never mutate the parent,
   * never auto-resume. */
  cancelRun: (id: string) => void;
  setSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;
}

interface StoreOpts {
  /** localStorage key for the persisted slice (selected backend id). */
  name: string;
  /** Base (seed) sessions for this workspace kind. */
  base: Session[];
  /** Default composer model. */
  defaultModel: string;
  /** Title for a freshly created session ("New session" / "New chat"). */
  newSessionTitle: string;
}

/**
 * Factory for an agents-style session store (Design-Sync P3). Agents and Chat
 * are the SAME component over two instances of this store — identical shape,
 * different seed sessions / default model / persist key. The only behavioural
 * difference (subagents + tool-actions) lives in the rendered data, not here.
 */
function createAgentsStore(opts: StoreOpts): UseBoundStore<StoreApi<AgentsState>> {
  const { base, defaultModel, newSessionTitle, name } = opts;
  return create<AgentsState>()(
    persist(
      (set, get) => ({
        extra: [],
        closed: [],
        activeId: base[0]?.id ?? "",
        runStates: {},
        handoffSeeds: {},

        model: defaultModel,
        effort: 3,
        budget: 200_000,
        terseEnabled: true,
        terseLevel: "full",
        terseHintSeen: false,
        routingEnabled: false,
        modelOverrides: {},
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
              title: newSessionTitle,
              // A fresh session has zero structured telemetry (Phase 1).
              telemetry: { tokensIn: 0, tokensOut: 0, runtimeMs: 0 },
            };
            return { extra: [...s.extra, session], activeId: id };
          }),

        handoffToNewSession: (parent, blocks) => {
          const s = get();
          const newId = `n${s.extra.length + 1}`;
          const { session, summary } = buildSessionHandoff(
            parent,
            blocks,
            newId,
            newSessionTitle,
          );
          set({
            extra: [...s.extra, session],
            activeId: newId,
            handoffSeeds: { ...s.handoffSeeds, [newId]: summary.text },
          });
          return newId;
        },

        closeSession: (id) =>
          set((s) => {
            const all = [...base, ...s.extra].filter((x) => !s.closed.includes(x.id));
            const remaining = all.filter((x) => x.id !== id);
            const nextActive =
              s.activeId === id && remaining.length ? remaining[0].id : s.activeId;
            return {
              extra: s.extra.filter((x) => x.id !== id),
              closed: s.closed.includes(id) ? s.closed : [...s.closed, id],
              activeId: nextActive,
            };
          }),

        setModel: (model) => set({ model }),
        setEffort: (effort) => set({ effort }),
        setBudget: (budget) => set({ budget }),
        setTerseEnabled: (terseEnabled) => set({ terseEnabled }),
        setTerseLevel: (terseLevel) => set({ terseLevel }),
        markTerseHintSeen: () => set({ terseHintSeen: true }),
        setRoutingEnabled: (routingEnabled) => set({ routingEnabled }),
        setModelOverride: (sessionId, model) =>
          set((s) => {
            const next = { ...s.modelOverrides };
            if (model) next[sessionId] = model;
            else delete next[sessionId];
            return { modelOverrides: next };
          }),
        setBackendKind: (backendKind) => set({ backendKind }),
        setSelectedBackend: (selectedBackendId) => set({ selectedBackendId }),
        setRunState: (id, run) => set((s) => ({ runStates: { ...s.runStates, [id]: run } })),
        // Cancel THIS session's run (composer-context-runtime P3, B3): set it
        // back to ready and touch NOTHING else — the parent session (a fork's
        // origin) is never mutated, and nothing is rescheduled (no auto-resume).
        // The live stream abort rides the AgentProvider unsubscribe when the
        // real run-loop subscribes; at this layer the run-state IS the signal.
        cancelRun: (id) => set((s) => ({ runStates: { ...s.runStates, [id]: "ready" } })),
        setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
        toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
      }),
      {
        name,
        // Persist the selected backend id + the terse prefs (a product
        // preference) — the rest of the store is session-ephemeral (sessions,
        // run states, popover open). Defaults (stub backend, terse ON at full,
        // hint unseen) match a fresh boot so CI / Playwright goldens are
        // unaffected (the composer control is the only new pixel — goldens for
        // the affected screens are regenerated alongside this phase).
        partialize: (s) => ({
          selectedBackendId: s.selectedBackendId,
          terseEnabled: s.terseEnabled,
          terseLevel: s.terseLevel,
          terseHintSeen: s.terseHintSeen,
          routingEnabled: s.routingEnabled,
          modelOverrides: s.modelOverrides,
        }),
      },
    ),
  );
}

const base = agentSnapshot.sessions;
const chatBase = chatSnapshot.sessions;

/** Agents workspace store (subagents + tool-actions). */
export const useAgents = createAgentsStore({
  name: "capisco-agents",
  base,
  defaultModel: "Opus 4.8",
  newSessionTitle: "New session",
});

/** Chat workspace store (quick chat · no tools) — a parallel instance. */
export const useChat = createAgentsStore({
  name: "capisco-chat",
  base: chatBase,
  defaultModel: "Sonnet 4.8",
  newSessionTitle: "New chat",
});

/** The store hook backing a given workspace kind (Design-Sync P3). */
export function storeForKind(kind: WorkspaceKind): UseBoundStore<StoreApi<AgentsState>> {
  return kind === "chat" ? useChat : useAgents;
}

/** Resolves the visible session list from a base mock + runtime additions. */
export function visibleSessions(
  extra: Session[],
  closed: string[],
  baseSessions: Session[] = base,
): Session[] {
  return [...baseSessions, ...extra].filter((s) => !closed.includes(s.id));
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
    return telemetry.tokensOut > 0 ? `idle · ${formatTokens(telemetry.tokensOut)} ↓` : "idle";
  }
  const totalSec = Math.round(telemetry.runtimeMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const time = `${m}m ${String(s).padStart(2, "0")}s`;
  return `${time} · ${formatTokens(telemetry.tokensOut)} ↓`;
}

export function formatTokens(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return String(n);
}

/** The context-budget tone bands (Design-Sync P4): green < 60% · orange < 85%
 * · red otherwise. Pure function of `used / budget` — the SAME thresholds the
 * Rot-banner uses (`crit` ⇔ banner shows). */
export type BudgetTone = "ok" | "warn" | "crit";
export function budgetTone(used: number, budget: number): BudgetTone {
  const ratio = budget > 0 ? used / budget : 0;
  if (ratio < 0.6) return "ok";
  if (ratio < 0.85) return "warn";
  return "crit";
}

/**
 * The context "used" tokens for the budget meter — the aggregated session
 * telemetry (B-pre `aggregateTelemetry` already rolled subagents into
 * `session.telemetry`). PURE projection: no new data model, just a read of the
 * tokens the session already reports.
 */
export function contextUsed(session: Session): number {
  return session.telemetry.tokensIn + session.telemetry.tokensOut;
}

/**
 * The EFFECTIVE model shown for a session (Phase 4). The human override always
 * wins; otherwise the session's own model. (The deterministic origin→tier
 * routing is a pure function tested in `lib/model-routing`; a mock session has
 * no origin, so the UI badge reflects override-or-own — the override is the
 * per-session human control the routing feature exposes.) PURE.
 */
export function effectiveModel(
  session: Session,
  modelOverrides: Record<string, string>,
): string {
  return modelOverrides[session.id] ?? session.model;
}
