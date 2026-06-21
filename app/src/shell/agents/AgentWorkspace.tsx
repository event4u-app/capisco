import * as React from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp } from "lucide-react";

import { Bot, Settings as SettingsIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { mockAgentProvider } from "@/mocks";
import { useLayout } from "@/shell/store";
import { usePalette } from "@/shell/command-registry";
import { SessionTabbar } from "./SessionTabbar";
import { SubagentRow } from "./SubagentRow";
import { Transcript } from "./Transcript";
import { ComposerBar } from "./ComposerBar";
import { AgentSettings } from "./AgentSettings";
import { useAgents, visibleSessions } from "./store";

/**
 * Agents workspace — the agent-native core (build-spec §4 / agent.jsx). Session
 * tabbar + subagent row + centered virtualized transcript + composer with
 * control bar. Rendered in the shell center when mode === "agents".
 */
export function AgentWorkspace() {
  const { t } = useTranslation();
  const setMode = useLayout((s) => s.setMode);

  const extra = useAgents((s) => s.extra);
  const closed = useAgents((s) => s.closed);
  const activeId = useAgents((s) => s.activeId);
  const runStates = useAgents((s) => s.runStates);
  const model = useAgents((s) => s.model);
  const effort = useAgents((s) => s.effort);
  const backendKind = useAgents((s) => s.backendKind);
  const setActive = useAgents((s) => s.setActive);
  const createSession = useAgents((s) => s.createSession);
  const closeSession = useAgents((s) => s.closeSession);
  const setModel = useAgents((s) => s.setModel);
  const setEffort = useAgents((s) => s.setEffort);
  const setBackendKind = useAgents((s) => s.setBackendKind);
  const setRunState = useAgents((s) => s.setRunState);
  const settingsOpen = useAgents((s) => s.settingsOpen);
  const toggleSettings = useAgents((s) => s.toggleSettings);
  const setSettingsOpen = useAgents((s) => s.setSettingsOpen);

  const register = usePalette((s) => s.register);
  const composerRef = React.useRef<HTMLInputElement>(null);

  // Self-register agent actions in the command palette (escalation ladder).
  React.useEffect(() => {
    const unNew = register({
      id: "agents:new-session",
      group: "view",
      icon: Bot,
      label: t("agents.command.newSession"),
      run: () => createSession(model),
    });
    const unSettings = register({
      id: "agents:settings",
      group: "view",
      icon: SettingsIcon,
      label: t("agents.command.settings"),
      run: () => setSettingsOpen(true),
    });
    return () => {
      unNew();
      unSettings();
    };
  }, [register, t, createSession, model, setSettingsOpen]);

  const sessions = visibleSessions(extra, closed);
  const cur = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const backend = mockAgentProvider.getBackend();

  const openFile = React.useCallback(() => {
    // Tool actions deep-link into the diff view (R1) — the shell remembers the
    // mode to return to on close.
    setMode("diff");
  }, [setMode]);

  const send = () => {
    const el = composerRef.current;
    if (el) el.value = "";
  };

  if (!cur) return null;

  const runState = runStates[cur.id] ?? "ready";
  const statusText =
    (backend.kind === "api" ? "API" : "CLI · claude 1.4.2") +
    " · 6.5k tokens · $0.04 · running 2m49s";

  return (
    <div
      data-testid="agent-workspace"
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
      />

      {cur.subs && cur.subs.length > 0 && <SubagentRow subs={cur.subs} />}

      <div className="min-h-0 flex-1 overflow-hidden">
        <Transcript
          session={cur}
          runState={runState}
          onRetry={() => setRunState(cur.id, "ready")}
          onOpenFile={openFile}
        />
      </div>

      <div className="shrink-0 border-t border-border bg-editor">
        <div className="mx-auto max-w-[740px] px-6 pb-2.5 pt-3">
          <div className="relative">
            <Input
              ref={composerRef}
              data-testid="composer-input"
              className="pr-9 font-mono"
              placeholder={t("agents.composer.placeholder")}
              aria-label={t("agents.composer.placeholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              data-testid="composer-send"
              aria-label={t("agents.composer.send")}
              className="absolute right-1 top-1/2 size-6 -translate-y-1/2 text-primary hover:text-primary"
              onClick={send}
            >
              <ArrowUp className="size-4" strokeWidth={1.8} />
            </Button>
          </div>
          <ComposerBar
            model={model}
            setModel={setModel}
            effort={effort}
            setEffort={setEffort}
            statusText={statusText}
          />
        </div>
      </div>

      {settingsOpen && (
        <AgentSettings
          backendKind={backendKind}
          setBackendKind={setBackendKind}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
