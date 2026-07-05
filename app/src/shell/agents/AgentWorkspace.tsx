import * as React from "react";
import { useTranslation } from "react-i18next";

import { Bot, Settings as SettingsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { agentSnapshot, chatSnapshot, mockWorktrees } from "@/mocks";
import { useOpenProject } from "@/shell/open-project-store";
import { useWorktrees } from "@/shell/worktree-store";
import { getProviders, isDesktop } from "@/lib/desktop-shell";
import type { MentionFieldElement } from "./MentionAutocomplete";
import { useLayout } from "@/shell/store";
import { usePalette } from "@/shell/command-registry";
import { SessionTabbar } from "./SessionTabbar";
import { SubagentRow } from "./SubagentRow";
import { Transcript } from "./Transcript";
import { Composer } from "./Composer";
import { AgentSettings } from "./AgentSettings";
import { useEditRerun } from "./use-edit-rerun";
import { useQueueDrain } from "./use-queue-drain";
import { TriangleAlert } from "lucide-react";
import {
  budgetTone,
  contextUsed,
  storeForKind,
  visibleSessions,
  type QueuedMessage,
  type WorkspaceKind,
} from "./store";

/**
 * Agents / Chat workspace — ONE parameterized component (Design-Sync P3). The
 * agent-native core (build-spec §4 / agent.jsx): session tabbar + subagent row
 * + centered virtualized transcript + composer with control bar. `kind="chat"`
 * reuses the exact same UI over a parallel store + chat sessions, minus
 * subagents / tool-actions (status "quick chat · no tools"). Rendered in the
 * shell center for `mode === "agents"` (kind agents) / `"chat"` (kind chat).
 */
/** Stable empty prompt-log reference (avoids a new [] each render → no churn). */
const EMPTY_LOG: string[] = [];
/** Stable empty message-queue reference (P5-A — same no-churn rationale). */
const EMPTY_QUEUE: QueuedMessage[] = [];

export function AgentWorkspace({ kind = "agents" }: { kind?: WorkspaceKind } = {}) {
  const { t } = useTranslation();
  const isChat = kind === "chat";
  const useStore = storeForKind(kind);
  const setMode = useLayout((s) => s.setMode);

  const extra = useStore((s) => s.extra);
  const closed = useStore((s) => s.closed);
  const activeId = useStore((s) => s.activeId);
  const runStates = useStore((s) => s.runStates);
  const handoffSeeds = useStore((s) => s.handoffSeeds);
  const handoffToNewSession = useStore((s) => s.handoffToNewSession);
  const model = useStore((s) => s.model);
  const effort = useStore((s) => s.effort);
  const budget = useStore((s) => s.budget);
  const setBudget = useStore((s) => s.setBudget);
  const terseEnabled = useStore((s) => s.terseEnabled);
  const terseLevel = useStore((s) => s.terseLevel);
  const terseHintSeen = useStore((s) => s.terseHintSeen);
  const setTerseEnabled = useStore((s) => s.setTerseEnabled);
  const setTerseLevel = useStore((s) => s.setTerseLevel);
  const markTerseHintSeen = useStore((s) => s.markTerseHintSeen);
  const routingEnabled = useStore((s) => s.routingEnabled);
  const modelOverrides = useStore((s) => s.modelOverrides);
  const setRoutingEnabled = useStore((s) => s.setRoutingEnabled);
  const backendKind = useStore((s) => s.backendKind);
  const setActive = useStore((s) => s.setActive);
  const createSession = useStore((s) => s.createSession);
  const closeSession = useStore((s) => s.closeSession);
  const setEffort = useStore((s) => s.setEffort);
  const setBackendKind = useStore((s) => s.setBackendKind);
  const setRunState = useStore((s) => s.setRunState);
  const cancelRun = useStore((s) => s.cancelRun);
  // P5-A cockpit control-flow: per-session message queue + run-completion seam.
  const messageQueues = useStore((s) => s.messageQueues);
  const runCompletions = useStore((s) => s.runCompletions);
  const enqueueMessage = useStore((s) => s.enqueueMessage);
  const dequeueMessage = useStore((s) => s.dequeueMessage);
  const removeQueued = useStore((s) => s.removeQueued);
  const reorderQueued = useStore((s) => s.reorderQueued);
  const editQueued = useStore((s) => s.editQueued);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const toggleSettings = useStore((s) => s.toggleSettings);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  // P4 input-reliability: per-session prompt-log + draft persistence.
  const appendPrompt = useStore((s) => s.appendPrompt);
  const saveDraft = useStore((s) => s.saveDraft);
  const clearDraft = useStore((s) => s.clearDraft);
  const promptLogs = useStore((s) => s.promptLogs);
  const draftBodies = useStore((s) => s.draftBodies);

  const register = usePalette((s) => s.register);
  const openProjectByPath = useOpenProject((s) => s.open);
  const worktreeCwd = useWorktrees((s) => s.activePath);
  const composerRef = React.useRef<MentionFieldElement>(null);
  // P5-A Edit-&-Rerun: tracks whether the buffer is a recalled prompt (↑) being
  // edited — a send then forks a "retry · edited" branch instead of overwriting.
  const editRerun = useEditRerun();

  // Clickable @-reference: open the referenced project through the existing
  // open-project flow (mid lesart — "Klick öffnet das Projekt / springt
  // dorthin"). A stale path (moved/renamed/deleted) resolves `false` so the
  // autocomplete shows a quiet note instead of a dead link or an error spew.
  const openReference = React.useCallback(
    async (project: { path: string }) => {
      await openProjectByPath(project.path);
      // The store swallows a failed open into its `error` field; treat a set
      // error for THIS path as "stale" (quiet), a clean open as success.
      const { error, project: opened } = useOpenProject.getState();
      return opened?.path === project.path && !error;
    },
    [openProjectByPath],
  );
  // The Rot-banner is dismissable per active session ("Keep going"). PURE UI
  // state — token-economy P2 wires the real behaviour behind these buttons.
  const [bannerDismissed, setBannerDismissed] = React.useState<Set<string>>(new Set());

  // Self-register the workspace actions in the command palette (escalation
  // ladder). Ids are namespaced by kind so Agents + Chat never collide.
  React.useEffect(() => {
    const unNew = register({
      id: `${kind}:new-session`,
      group: "view",
      icon: Bot,
      label: t(isChat ? "chat.command.newSession" : "agents.command.newSession"),
      run: () => createSession(model),
    });
    const unSettings = register({
      id: `${kind}:settings`,
      group: "view",
      icon: SettingsIcon,
      label: t(isChat ? "chat.command.settings" : "agents.command.settings"),
      run: () => setSettingsOpen(true),
    });
    return () => {
      unNew();
      unSettings();
    };
  }, [register, t, createSession, model, setSettingsOpen, kind, isChat]);

  const baseSessions = isChat ? chatSnapshot.sessions : agentSnapshot.sessions;
  const sessions = visibleSessions(extra, closed, baseSessions);
  const cur = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const backend = agentSnapshot.backend;
  // P4: the active session's prompt-log (history-recall) + restored draft.
  const promptLog = cur ? (promptLogs[cur.id] ?? EMPTY_LOG) : EMPTY_LOG;
  const initialDraft = cur ? (draftBodies[cur.id] ?? "") : "";

  // P2 — the REAL selected backend + USD cost over the live sidecar. In the
  // browser (mock) path these stay null and the deterministic labels below are
  // used unchanged (pixel goldens byte-identical). On desktop the composer bar
  // shows the actual backend (no longer "API") and real cost from telemetry.
  const [liveBackendLabel, setLiveBackendLabel] = React.useState<string | null>(null);
  const [liveCostUsd, setLiveCostUsd] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!isDesktop() || !cur) return;
    const p = getProviders();
    if (!p.agentBackend) return; // partial bundle (some tests) — keep mock labels
    let cancelled = false;
    void p.agentBackend
      .current()
      .then((cfg) => {
        if (!cancelled)
          setLiveBackendLabel(cfg.kind === "api" ? cfg.provider : `CLI · ${cfg.provider}`);
      })
      .catch(() => {});
    void p.agentBackend
      .cost(cur.model, cur.telemetry)
      .then((usd) => {
        if (!cancelled) setLiveCostUsd(usd);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cur?.id, cur?.model, cur?.telemetry]);

  const openFile = React.useCallback(() => {
    // Tool actions deep-link into the diff view (R1) — the shell remembers the
    // mode to return to on close.
    setMode("diff");
  }, [setMode]);

  // One-time terse hint (Phase 2): the FIRST time the user sends a turn while
  // terse is on, surface "this is intentional, not broken/rude". Gated on the
  // persisted `terseHintSeen` so it shows exactly once — and only on a real send
  // (never on the pre-seeded mock transcript → visual harness goldens intact).
  const [terseHintOpen, setTerseHintOpen] = React.useState(false);
  // The actual send of a concrete text — composer-independent, so both the
  // composer send and the P5-A queue-drain reuse it. `branchLabel` (set when a
  // recalled prompt was edited) forks a retry sibling via the existing
  // `SessionTree.branch()` — pure tree bookkeeping, never overwrites, both paths.
  const runSend = (text: string, branchLabel?: string | null) => {
    if (!cur) return;
    // Start the run (P3): the session goes `loading`, which drives the composer's
    // Stop affordance. Preserved on an empty send (the pre-existing behaviour).
    setRunState(cur.id, "loading");
    if (terseEnabled && !terseHintSeen) {
      setTerseHintOpen(true);
      markTerseHintSeen();
    }
    if (!text) return;
    // P4: log the sent prompt + drop the now-obsolete draft.
    appendPrompt(cur.id, text);
    clearDraft(cur.id);
    const agent = getProviders().agent;
    // P5-A: a recalled-then-edited prompt forks a retry sibling via the existing
    // `SessionTree.branch()` — pure tree bookkeeping, never overwrites, both paths.
    if (branchLabel && agent?.getTree && agent?.branch) {
      const sid = cur.id;
      void agent.getTree(sid).then((tree) => agent.branch(sid, tree.activeLeaf, branchLabel));
    }
    // Live agent run (road-to-agent-backend-enablement): only when a desktop
    // bridge is present AND this is the agents kind. No bridge → mock path is
    // untouched (the browser/visual harness never reaches this). Chat has no
    // tools / live run, so it stays mock-only too.
    if (!isChat && isDesktop()) {
      void agent.sendPrompt(cur.id, text);
    }
  };
  const send = () => {
    const el = composerRef.current;
    // Capture the typed turn BEFORE clearing — a live run needs the text.
    const text = el?.value?.trim();
    if (!cur) return;
    // P5-A: while THIS session's run is in flight, a send appends to a visible
    // per-session queue instead of starting a competing run (text only — an
    // empty send while running is a no-op, never a phantom queue entry).
    if (text && (runStates[cur.id] ?? "ready") === "loading") {
      enqueueMessage(cur.id, text);
      if (el) el.value = "";
      clearDraft(cur.id);
      return;
    }
    // P5-A: a recalled-then-edited prompt forks a "retry · edited" branch.
    const branchLabel = text ? editRerun.branchLabel() : null;
    editRerun.onSend();
    if (el) el.value = "";
    runSend(text ?? "", branchLabel);
  };
  const dismissTerseHint = () => setTerseHintOpen(false);

  // P5-A queue-drain: fire the head of the active session's queue when its run
  // completes (`completeRun` bumps `runCompletions`; a Stop/`cancelRun` does
  // not, so a Stop never drains). Hook runs unconditionally (before the `cur`
  // guard); a missing session is a no-op baseline.
  const fireNext = React.useCallback(() => {
    if (!cur) return;
    const item = dequeueMessage(cur.id);
    if (item) runSend(item.text);
    // runSend is recreated each render but reads current closures; deps kept
    // minimal to the identity that matters (the active session + dequeue).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id, dequeueMessage]);
  useQueueDrain(cur?.id ?? "", cur ? (runCompletions[cur.id] ?? 0) : 0, fireNext);

  if (!cur) return null;

  const runState = runStates[cur.id] ?? "ready";
  // Context-budget projection (Design-Sync P4): used = the active session's
  // already-reported tokens; the Rot-banner shows when the tone is `crit`
  // (≥ 85% of budget) and the user has not dismissed it for this session.
  const used = contextUsed(cur);
  const budgetCritical = budgetTone(used, budget) === "crit" && !bannerDismissed.has(cur.id);
  const budgetPct = budget > 0 ? Math.round((used / budget) * 100) : 0;
  const dismissBanner = () => setBannerDismissed((prev) => new Set(prev).add(cur.id));
  // Red→new-session handoff (Phase 1): start a fresh session seeded with a
  // COMPRESSED summary of the current one. Human-initiated; never auto-fired.
  const startHandoff = () => {
    const blocks = isChat ? chatSnapshot.blocks(cur.id) : agentSnapshot.blocks(cur.id);
    handoffToNewSession(cur, blocks);
  };
  // Seed text for THIS session if it was created by a handoff (the empty
  // transcript renders it so the fresh session is not a blank restart).
  const handoffSeed = handoffSeeds[cur.id];
  const backendLabel =
    liveBackendLabel ?? (backend.kind === "api" ? "API" : "CLI · claude 1.4.2");
  const costStr = liveCostUsd !== null ? `$${liveCostUsd.toFixed(2)}` : "$0.04";
  // Chat is a quick assistant chat (no tools); Agents shows live run telemetry.
  const statusText = isChat
    ? `${backendLabel} · quick chat · no tools`
    : `${backendLabel} · 6.5k tokens · ${costStr} · running 2m49s`;

  return (
    <div
      data-testid={isChat ? "chat-workspace" : "agent-workspace"}
      data-kind={kind}
      className="relative flex min-h-0 flex-1 flex-col overflow-visible bg-editor"
    >
      <SessionTabbar
        sessions={sessions}
        activeId={cur.id}
        onSelect={setActive}
        onClose={closeSession}
        onCreate={createSession}
        settingsOpen={settingsOpen}
        onToggleSettings={toggleSettings}
        modelOverrides={modelOverrides}
      />

      {/* Subagents are an agents-only concept — Chat never fans out. */}
      {!isChat && cur.subs && cur.subs.length > 0 && <SubagentRow subs={cur.subs} />}

      <div className="min-h-0 flex-1 overflow-hidden">
        <Transcript
          kind={kind}
          session={cur}
          runState={runState}
          onRetry={() => setRunState(cur.id, "ready")}
          onOpenFile={openFile}
          onRevertPath={(path) => {
            // P4 — broker-gated, git-authoritative worktree hunk-revert. Honest
            // `skipped` without a worktree (the provider decides; never a fake).
            void getProviders().revert.revertPath(worktreeCwd, path);
          }}
          handoffSeed={handoffSeed}
        />
      </div>

      <div className="shrink-0 border-t border-border bg-editor">
        <div className="mx-auto max-w-[740px] px-6 pb-2.5 pt-3">
          {/* Rot-banner (Design-Sync P4) — shown at ≥85% budget. Buttons are
              token-economy P2 STUBS: no session lifecycle wired here. */}
          {budgetCritical && (
            <div
              data-testid="context-banner"
              role="alert"
              className="mb-2.5 flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5"
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-destructive"
                strokeWidth={1.8}
                aria-hidden
              />
              <div className="min-w-0 flex-1 text-ui text-foreground">
                <b>{t("agents.composer.bannerTitle", { pct: budgetPct })}</b>{" "}
                {t("agents.composer.bannerBody")}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  data-testid="context-banner-new"
                  onClick={startHandoff}
                >
                  {t("agents.composer.newSession")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="context-banner-keep"
                  onClick={dismissBanner}
                >
                  {t("agents.composer.keepGoing")}
                </Button>
              </div>
            </div>
          )}
          {/* One-time terse hint (Phase 2) — shown after the first terse send. */}
          {terseHintOpen && (
            <div
              data-testid="terse-hint"
              role="status"
              className="mb-2.5 flex items-start gap-2.5 rounded-md border border-border bg-muted/50 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1 text-ui text-muted-foreground">
                <b className="text-foreground">{t("agents.composer.terseHintTitle")}</b>{" "}
                {t("agents.composer.terseHintBody")}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="terse-hint-dismiss"
                onClick={dismissTerseHint}
              >
                {t("agents.composer.terseHintDismiss")}
              </Button>
            </div>
          )}
          <Composer
            isChat={isChat}
            effort={effort}
            setEffort={setEffort}
            statusText={statusText}
            used={used}
            budget={budget}
            setBudget={setBudget}
            routingEnabled={routingEnabled}
            setRoutingEnabled={setRoutingEnabled}
            composerRef={composerRef}
            onSend={send}
            running={runState === "loading"}
            onStop={() => cancelRun(cur.id)}
            currentProject={mockWorktrees[0]?.name}
            onOpenReference={openReference}
            sessionId={cur.id}
            promptLog={promptLog}
            initialDraft={initialDraft}
            saveDraft={saveDraft}
            clearDraft={clearDraft}
            projectRoot={worktreeCwd}
            promptLogs={promptLogs}
            editRerun={editRerun}
            queue={cur ? (messageQueues[cur.id] ?? EMPTY_QUEUE) : EMPTY_QUEUE}
            onRemoveQueued={(itemId) => removeQueued(cur.id, itemId)}
            onReorderQueued={(from, to) => reorderQueued(cur.id, from, to)}
            onEditQueued={(itemId, text) => editQueued(cur.id, itemId, text)}
          />
        </div>
      </div>

      {settingsOpen && (
        <AgentSettings
          backendKind={backendKind}
          setBackendKind={setBackendKind}
          onClose={() => setSettingsOpen(false)}
          routingEnabled={routingEnabled}
          setRoutingEnabled={setRoutingEnabled}
          terseEnabled={terseEnabled}
          setTerseEnabled={setTerseEnabled}
          terseLevel={terseLevel}
          setTerseLevel={setTerseLevel}
        />
      )}
    </div>
  );
}

/** Chat workspace — the same component, parameterized to the chat kind. */
export function ChatWorkspace() {
  return <AgentWorkspace kind="chat" />;
}
