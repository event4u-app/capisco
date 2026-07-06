import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist } from "zustand/middleware";

import { agentSnapshot, chatSnapshot } from "@/mocks";
import type { Session, TranscriptBlock } from "@/contracts";
import { buildSessionHandoff } from "./handoff";

/** Per-agent-run lifecycle state (drives loading / error / ready transcripts). */
export type RunState = "ready" | "loading" | "error";

/**
 * A message queued while a run is in flight (Agent-Cockpit P5-A). Fired in FIFO
 * order when the run completes. `id` is a stable per-store monotonic handle (not
 * a timestamp / random — keeps the store deterministic).
 */
export interface QueuedMessage {
  id: string;
  text: string;
}

/** Monotonic id source for queued messages (per module load; deterministic). */
let queueSeq = 0;

/**
 * A named checkpoint on a session's branching tree (Agent-Cockpit P5-A / S8).
 * Names the `SessionTree` leaf active at checkpoint time so the branch-switcher
 * can jump back to that divergent prompt line. `id`/`seq` are deterministic
 * per-store handles (no timestamp / random).
 */
export interface CheckpointEntry {
  id: string;
  label: string;
  /** The `SessionTree.activeLeaf` captured when the checkpoint was named. */
  leafId: string;
  seq: number;
}

/** Monotonic id source for checkpoints (per module load; deterministic). */
let checkpointSeq = 0;

/**
 * A saved prompt / template (composer-intelligence S9). Persisted, cross-session
 * — the `/`-provider surfaces these for fill-or-rerun. `id` is a deterministic
 * per-store monotonic handle (no timestamp / random).
 */
export interface SavedPrompt {
  id: string;
  label: string;
  body: string;
}

/** Monotonic id source for saved prompts (per module load; deterministic). */
let savedPromptSeq = 0;

/** Maximum number of sent prompts kept per session (FIFO ring). */
const MAX_PROMPT_LOG_SIZE = 100;
/** Maximum characters stored for an unsent composer draft. */
const MAX_DRAFT_CHARS = 10_000;

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
  /** Scoped-grant / bulk-run preview (item 229). When on (default), a file-write
   * permission prompt offers a task-bound "grant N writes under <prefix>/" scope
   * with a pattern-coverage preview; when off, only Once/Session/Deny. PERSISTED. */
  scopedGrantsEnabled: boolean;
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

  /**
   * Per-session sent-prompt history (input reliability P4). Capped at
   * MAX_PROMPT_LOG_SIZE entries, FIFO. Entries are appended by `appendPrompt`
   * after the composer sends; the history-recall hook reads this log. PERSISTED
   * (cross-boot recall is a key UX feature). Most-recent-LAST order.
   */
  promptLogs: Record<string, string[]>;

  /**
   * Per-session unsent composer body (input reliability P4). The key is absent
   * (never "") when there is nothing to restore — `saveDraft` deletes the key on
   * empty/whitespace input. PERSISTED (a crash-recovery / tab-switch feature).
   */
  draftBodies: Record<string, string>;

  /**
   * Per-session message queue (Agent-Cockpit P5-A). Messages appended via
   * `Cmd+Enter` while a run is in flight; drained FIFO on run COMPLETION (never
   * on cancel). The key is absent (never []) when the queue is empty — an empty
   * queue renders nothing. Ephemeral (a pending queue is meaningless across
   * boots), so NOT persisted.
   */
  messageQueues: Record<string, QueuedMessage[]>;
  /**
   * Per-session named checkpoints (Agent-Cockpit P5-A / S8). The branch-switcher
   * lists these; jumping to one forks from its leaf via `SessionTree.branch()`.
   * Empty (key absent) until the user names one → the switcher is invisible at
   * boot (golden-safe). Ephemeral — leaf ids are in-memory tree pointers that do
   * not survive a restart — so NOT persisted.
   */
  checkpoints: Record<string, CheckpointEntry[]>;
  /**
   * Saved prompts / templates (composer-intelligence S9). Cross-session,
   * PERSISTED — surfaced by the `/`-autocomplete provider for fill-or-rerun.
   */
  savedPrompts: SavedPrompt[];
  /**
   * Per-session run-completion counter (Agent-Cockpit P5-A). Bumped ONLY by
   * `completeRun` (a natural run finish), never by `cancelRun` (Stop). The
   * queue-drain hook watches this counter so a Stop never fires the queue —
   * `runState` alone can't distinguish the two (both settle to "ready").
   * Ephemeral (not persisted).
   */
  runCompletions: Record<string, number>;

  /** Context-budget warn threshold in tokens (Design-Sync P4). The meter turns
   * green < 60% · orange < 85% · red otherwise of this budget. PURE projection:
   * setting it only moves the warning line; no behaviour is wired here (the
   * Rot-banner buttons are token-economy P2 stubs). Ephemeral (not persisted). */
  budget: number;

  // Backend settings popover.
  backendKind: "api" | "cli";
  settingsOpen: boolean;
  /** Selected agent backend id (B8 P3) — the WORKSPACE default; persisted. */
  selectedBackendId: string;
  /** Per-session selected backend (P3 — switch agent/CLI within a chat). A chat
   * remembers its own backend; falls back to {@link selectedBackendId}. Persisted. */
  selectedBackendIdBySession: Record<string, string>;

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
  setScopedGrantsEnabled: (on: boolean) => void;
  setTerseLevel: (level: TerseLevel) => void;
  markTerseHintSeen: () => void;
  setRoutingEnabled: (on: boolean) => void;
  /** Per-session human override (the human always wins over routing). Empty string clears. */
  setModelOverride: (sessionId: string, model: string) => void;
  /**
   * Append a sent prompt to the session's log (input reliability P4). Silently
   * drops blank text. The log is capped at MAX_PROMPT_LOG_SIZE entries (FIFO).
   */
  appendPrompt: (sessionId: string, text: string) => void;
  /**
   * Persist a draft body for the session (input reliability P4). Empty or
   * whitespace-only body DELETES the key — never stores "". Bodies are
   * truncated to MAX_DRAFT_CHARS before storage.
   */
  saveDraft: (sessionId: string, body: string) => void;
  /** Remove a session's draft (called after successful send). */
  clearDraft: (sessionId: string) => void;

  setBackendKind: (kind: "api" | "cli") => void;
  setSelectedBackend: (id: string) => void;
  /** Set the backend for ONE session (P3 — per-chat agent/CLI switch). */
  setSessionBackend: (sessionId: string, id: string) => void;
  setRunState: (id: string, run: RunState) => void;
  /** Cancel a session's run (P3 / B3): set it ready, never mutate the parent,
   * never auto-resume. Does NOT drain the message queue (a Stop is not a
   * completion). */
  cancelRun: (id: string) => void;
  /**
   * Mark a session's run COMPLETE (Agent-Cockpit P5-A): set it ready AND bump
   * `runCompletions[id]` so the queue-drain hook fires the next queued message.
   * Distinct from `cancelRun` (Stop) precisely so a cancel never drains. The
   * live `subscribe('done') → completeRun` wire lands with the real-runtime
   * track; at this layer `completeRun` is the honest drain seam.
   */
  completeRun: (id: string) => void;
  /** Append a message to a session's queue (P5-A). Drops blank text. */
  enqueueMessage: (sessionId: string, text: string) => void;
  /** Remove the head of a session's queue and return it (P5-A drain step). */
  dequeueMessage: (sessionId: string) => QueuedMessage | undefined;
  /** Remove a queued message by id (P5-A). */
  removeQueued: (sessionId: string, itemId: string) => void;
  /** Move a queued message from one index to another (P5-A reorder). */
  reorderQueued: (sessionId: string, from: number, to: number) => void;
  /** Replace a queued message's text (P5-A inline edit). Blank text removes it. */
  editQueued: (sessionId: string, itemId: string, text: string) => void;
  /** Name the given SessionTree leaf as a checkpoint on the session (S8). */
  addCheckpoint: (sessionId: string, label: string, leafId: string) => void;
  /** Save a prompt template (S9). Blank body is ignored; dedupes identical bodies. */
  savePrompt: (body: string, label?: string) => void;
  /** Delete a saved prompt template by id (S9). */
  deleteSavedPrompt: (id: string) => void;
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
        promptLogs: {},
        draftBodies: {},
        messageQueues: {},
        checkpoints: {},
        savedPrompts: [],
        runCompletions: {},

        model: defaultModel,
        effort: 3,
        budget: 200_000,
        terseEnabled: true,
        scopedGrantsEnabled: true,
        terseLevel: "full",
        terseHintSeen: false,
        routingEnabled: false,
        modelOverrides: {},
        backendKind: "api",
        settingsOpen: false,
        selectedBackendId: agentSnapshot.defaultBackendId,
        selectedBackendIdBySession: {},

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
        setScopedGrantsEnabled: (scopedGrantsEnabled) => set({ scopedGrantsEnabled }),
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
        appendPrompt: (sessionId, text) => {
          if (!text.trim()) return;
          set((s) => {
            const prev = s.promptLogs[sessionId] ?? [];
            const next = [...prev, text].slice(-MAX_PROMPT_LOG_SIZE);
            return { promptLogs: { ...s.promptLogs, [sessionId]: next } };
          });
        },

        saveDraft: (sessionId, body) =>
          set((s) => {
            const next = { ...s.draftBodies };
            const trimmed = body.slice(0, MAX_DRAFT_CHARS);
            if (trimmed.trim()) {
              next[sessionId] = trimmed;
            } else {
              delete next[sessionId];
            }
            return { draftBodies: next };
          }),

        clearDraft: (sessionId) =>
          set((s) => {
            const next = { ...s.draftBodies };
            delete next[sessionId];
            return { draftBodies: next };
          }),

        setBackendKind: (backendKind) => set({ backendKind }),
        setSelectedBackend: (selectedBackendId) => set({ selectedBackendId }),
        setSessionBackend: (sessionId, id) =>
          set((s) => ({
            selectedBackendIdBySession: { ...s.selectedBackendIdBySession, [sessionId]: id },
          })),
        setRunState: (id, run) => set((s) => ({ runStates: { ...s.runStates, [id]: run } })),
        // Cancel THIS session's run (composer-context-runtime P3, B3): set it
        // back to ready and touch NOTHING else — the parent session (a fork's
        // origin) is never mutated, and nothing is rescheduled (no auto-resume).
        // The live stream abort rides the AgentProvider unsubscribe when the
        // real run-loop subscribes; at this layer the run-state IS the signal.
        cancelRun: (id) => set((s) => ({ runStates: { ...s.runStates, [id]: "ready" } })),
        // Natural completion (P5-A): settle to ready AND bump the completion
        // counter so the queue-drain hook fires the next queued message. A Stop
        // (`cancelRun`) settles to ready WITHOUT bumping — so it never drains.
        completeRun: (id) =>
          set((s) => ({
            runStates: { ...s.runStates, [id]: "ready" },
            runCompletions: { ...s.runCompletions, [id]: (s.runCompletions[id] ?? 0) + 1 },
          })),
        enqueueMessage: (sessionId, text) => {
          const body = text.trim();
          if (!body) return;
          set((s) => {
            const prev = s.messageQueues[sessionId] ?? [];
            const item: QueuedMessage = { id: `q${++queueSeq}`, text: body };
            return { messageQueues: { ...s.messageQueues, [sessionId]: [...prev, item] } };
          });
        },
        dequeueMessage: (sessionId) => {
          const prev = get().messageQueues[sessionId] ?? [];
          if (!prev.length) return undefined;
          const [head, ...rest] = prev;
          set((s) => {
            const next = { ...s.messageQueues };
            if (rest.length) next[sessionId] = rest;
            else delete next[sessionId];
            return { messageQueues: next };
          });
          return head;
        },
        removeQueued: (sessionId, itemId) =>
          set((s) => {
            const prev = s.messageQueues[sessionId];
            if (!prev) return {};
            const kept = prev.filter((x) => x.id !== itemId);
            const next = { ...s.messageQueues };
            if (kept.length) next[sessionId] = kept;
            else delete next[sessionId];
            return { messageQueues: next };
          }),
        reorderQueued: (sessionId, from, to) =>
          set((s) => {
            const prev = s.messageQueues[sessionId];
            if (!prev || from === to) return {};
            if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return {};
            const next = [...prev];
            const [item] = next.splice(from, 1);
            next.splice(to, 0, item!);
            return { messageQueues: { ...s.messageQueues, [sessionId]: next } };
          }),
        editQueued: (sessionId, itemId, text) =>
          set((s) => {
            const prev = s.messageQueues[sessionId];
            if (!prev) return {};
            const body = text.trim();
            const mapped = body
              ? prev.map((x) => (x.id === itemId ? { ...x, text: body } : x))
              : prev.filter((x) => x.id !== itemId);
            const next = { ...s.messageQueues };
            if (mapped.length) next[sessionId] = mapped;
            else delete next[sessionId];
            return { messageQueues: next };
          }),
        addCheckpoint: (sessionId, label, leafId) =>
          set((s) => {
            const prev = s.checkpoints[sessionId] ?? [];
            const entry: CheckpointEntry = {
              id: `cp${++checkpointSeq}`,
              label: label.trim() || `checkpoint ${prev.length + 1}`,
              leafId,
              seq: checkpointSeq,
            };
            return { checkpoints: { ...s.checkpoints, [sessionId]: [...prev, entry] } };
          }),
        savePrompt: (body, label) =>
          set((s) => {
            const trimmed = body.trim();
            if (!trimmed) return {};
            // Dedupe identical bodies — saving the same prompt twice is a no-op.
            if (s.savedPrompts.some((p) => p.body === trimmed)) return {};
            const entry: SavedPrompt = {
              id: `sp${++savedPromptSeq}`,
              label: (label ?? "").trim() || trimmed.split("\n")[0]!.slice(0, 60),
              body: trimmed,
            };
            return { savedPrompts: [...s.savedPrompts, entry] };
          }),
        deleteSavedPrompt: (id) =>
          set((s) => ({ savedPrompts: s.savedPrompts.filter((p) => p.id !== id) })),
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
          selectedBackendIdBySession: s.selectedBackendIdBySession,
          terseEnabled: s.terseEnabled,
          scopedGrantsEnabled: s.scopedGrantsEnabled,
          terseLevel: s.terseLevel,
          terseHintSeen: s.terseHintSeen,
          routingEnabled: s.routingEnabled,
          modelOverrides: s.modelOverrides,
          promptLogs: s.promptLogs,
          savedPrompts: s.savedPrompts,
          draftBodies: s.draftBodies,
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

/**
 * Full sent-prompt history for a session (input reliability P4). Most-recent-LAST
 * order (matches append order). Returns an empty array when nothing has been
 * sent. PURE.
 */
export function sessionPromptLog(store: AgentsState, sessionId: string): string[] {
  return store.promptLogs[sessionId] ?? [];
}

/**
 * Last `n` sent prompts for a session (input reliability P4). Most-recent-FIRST
 * (history-recall natural order — pressing ↑ shows the most-recent entry first).
 * PURE.
 */
export function recentPrompts(store: AgentsState, sessionId: string, n = 5): string[] {
  const log = store.promptLogs[sessionId] ?? [];
  return log.slice(-n).reverse();
}
