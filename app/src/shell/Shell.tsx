import { useTranslation } from "react-i18next";
import { TitleBar } from "./TitleBar";
import { StatusBar } from "./StatusBar";
import { ActivityBar } from "./ActivityBar";
import { PanelStack } from "./PanelStack";
import { PanelContent } from "./PanelContent";
import { Terminal, TerminalSplitter } from "./Terminal";
import { DiffView } from "./DiffView";
import { AgentWorkspace } from "./agents/AgentWorkspace";
import { EditorWorkspace } from "./editor/EditorWorkspace";
import { GitWorkspace } from "./git/GitWorkspace";
import { TasksWorkspace } from "./tasks/TasksWorkspace";
import { CommandPalette } from "./CommandPalette";
import { usePaletteShortcut } from "./command-registry";
import { FlyoutOverlay } from "./signals/FlyoutOverlay";
import { isFlyoutTool, useActiveOverlayFlyout, useLayout } from "./store";

const PANEL_LEFT_W = 260;
const PANEL_RIGHT_W = 340;

/**
 * Capisco window shell — fixed chrome around the dockable panels and the
 * flexible center workspace. Rows: title 40 / main 1fr / status 26. The main
 * row is a 5-column grid: [48 rail][left panel][center 1fr][right panel][48 rail].
 * Empty panel columns collapse to 0px (build-spec §2 / Akzeptanz DOM-assert).
 */
export function Shell() {
  const { t } = useTranslation();
  usePaletteShortcut();

  const mode = useLayout((s) => s.mode);
  const topActive = useLayout((s) => s.topActive);
  const botActive = useLayout((s) => s.botActive);
  const rTopActive = useLayout((s) => s.rTopActive);
  const rBotActive = useLayout((s) => s.rBotActive);
  const leftSplit = useLayout((s) => s.leftSplit);
  const rightSplit = useLayout((s) => s.rightSplit);
  const setLeftSplit = useLayout((s) => s.setLeftSplit);
  const setRightSplit = useLayout((s) => s.setRightSplit);
  const terminalOpen = useLayout((s) => s.terminalOpen);
  const terminalHeight = useLayout((s) => s.terminalHeight);
  const pinnedFlyouts = useLayout((s) => s.pinnedFlyouts);
  const select = useLayout((s) => s.select);

  // An unpinned flyout floats OVER the workspace (overlay) — it does not occupy
  // a docked panel slot. A pinned flyout (or any non-flyout tool) docks normally.
  const overlayFlyout = useActiveOverlayFlyout();
  const dockable = (id: string | null): string | null =>
    id && (!isFlyoutTool(id) || pinnedFlyouts.includes(id)) ? id : null;
  const rTopDock = dockable(rTopActive);
  const rBotDock = dockable(rBotActive);

  const leftPanelOpen = !!topActive || !!botActive;
  const rightPanelOpen = !!rTopDock || !!rBotDock;

  const gridCols = [
    "48px",
    leftPanelOpen ? `${PANEL_LEFT_W}px` : "0px",
    "minmax(0,1fr)",
    rightPanelOpen ? `${PANEL_RIGHT_W}px` : "0px",
    "48px",
  ].join(" ");

  return (
    <div
      data-testid="shell"
      className="grid h-screen grid-rows-[40px_1fr_26px] overflow-hidden bg-background text-foreground"
    >
      <TitleBar />
      <div
        data-testid="main-row"
        className="grid overflow-hidden"
        style={{ gridTemplateColumns: gridCols }}
      >
        <ActivityBar side="left" />

        <div
          data-testid="left-panel"
          className="min-h-0 overflow-hidden border-r border-border bg-card"
        >
          {leftPanelOpen && (
            <PanelStack
              testid="left-panel-stack"
              topId={topActive}
              botId={botActive}
              ratio={leftSplit}
              setRatio={setLeftSplit}
              renderContent={(id) => <PanelContent id={id} />}
            />
          )}
        </div>

        <div data-testid="center" className="relative flex min-h-0 min-w-0 flex-col overflow-hidden">
          <section
            data-testid="workspace"
            data-mode={mode}
            // A click in the workspace dismisses an open UNPINNED flyout overlay
            // (R6 §2). The overlay stops propagation on its own clicks.
            onClickCapture={overlayFlyout ? () => select(overlayFlyout) : undefined}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          >
            {mode === "diff" ? (
              <DiffView />
            ) : mode === "agents" ? (
              <AgentWorkspace />
            ) : mode === "editor" ? (
              <EditorWorkspace />
            ) : mode === "git" ? (
              <GitWorkspace />
            ) : mode === "tasks" ? (
              <TasksWorkspace />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <span className="font-mono text-code lowercase text-muted-foreground">
                  {t("workspace.placeholder", { mode })}
                </span>
              </div>
            )}
          </section>
          {terminalOpen && (
            <>
              <TerminalSplitter />
              <div
                data-testid="terminal-panel"
                className="flex min-h-0 flex-col overflow-hidden"
                style={{ height: terminalHeight }}
              >
                <Terminal />
              </div>
            </>
          )}
          {overlayFlyout && <FlyoutOverlay channel={overlayFlyout} />}
        </div>

        <div
          data-testid="right-panel"
          className="min-h-0 overflow-hidden border-l border-border bg-card"
        >
          {rightPanelOpen && (
            <PanelStack
              testid="right-panel-stack"
              topId={rTopDock}
              botId={rBotDock}
              ratio={rightSplit}
              setRatio={setRightSplit}
              renderContent={(id) => <PanelContent id={id} />}
            />
          )}
        </div>

        <ActivityBar side="right" />
      </div>
      <StatusBar />
      <CommandPalette />
    </div>
  );
}
