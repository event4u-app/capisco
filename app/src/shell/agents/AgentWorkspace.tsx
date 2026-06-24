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
import { TriangleAlert } from "lucide-react";
import {
  budgetTone,
  contextUsed,
  storeForKind,
  visibleSessions,
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
  const settingsOpen = useStore((s) => s.settingsOpen);
  const toggleSettings = useStore((s) => s.toggleSettings);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  const register = usePalette((s) => s.register);
  const openProjectByPath = useOpenProject((s) => s.open);
  const worktreeCwd = useWorktrees((s) => s.activePath);
  const composerRef = React.useRef<MentionFieldElement>(null);

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
  const send = () => {
    const el = composerRef.current;
    // Capture the typed turn BEFORE clearing — a live run needs the text.
    const text = el?.value?.trim();
    if (el) el.value = "";
    // Start the run (P3): the session goes `loading`, which drives the
    // composer's Stop affordance. The real stream lands on the AgentProvider;
    // here the run-state is the in-flight signal a Stop can cancel.
    if (cur) setRunState(cur.id, "loading");
    if (terseEnabled && !terseHintSeen) {
      setTerseHintOpen(true);
      markTerseHintSeen();
    }
    // Live agent run (road-to-agent-backend-enablement): only when a desktop
    // bridge is present AND this is the agents kind. No bridge → mock path is
    // untouched (the browser/visual harness never reaches this). Chat has no
    // tools / live run, so it stays mock-only too.
    if (text && cur && !isChat && isDesktop()) {
      void getProviders().agent.sendPrompt(cur.id, text);
    }
  };
  const dismissTerseHint = () => setTerseHintOpen(false);

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
  const backendLabel = backend.kind === "api" ? "API" : "CLI · claude 1.4.2";
  // Chat is a quick assistant chat (no tools); Agents shows live run telemetry.
  const statusText = isChat
    ? `${backendLabel} · quick chat · no tools`
    : `${backendLabel} · 6.5k tokens · $0.04 · running 2m49s`;

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
