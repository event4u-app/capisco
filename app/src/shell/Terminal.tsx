import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, SplitSquareHorizontal, SquareTerminal, Trash2, X } from "lucide-react";
import { Terminal as Xterm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Icon } from "@/components/icon";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { getProviders } from "@/lib/desktop-shell";
import { useOpenProject } from "@/shell/open-project-store";
import { useWorktrees } from "@/shell/worktree-store";
import { useLayout } from "./store";

interface TermTab {
  id: string;
  label: string;
  /** PTY ids shown side-by-side in this tab (1 normally, 2 when split). */
  panes: string[];
}

const INITIAL_TABS: TermTab[] = [
  { id: "local", label: "Local", panes: ["local"] },
  { id: "py2ts", label: "Py2Ts", panes: ["py2ts"] },
  { id: "evidence", label: "Evidence", panes: ["evidence"] },
];

/** Read an xterm theme from the design-system CSS vars so it tracks light/dark. */
function readXtermTheme(el: HTMLElement): Record<string, string> {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string): string =>
    cs.getPropertyValue(name).trim() || fallback;
  const fg = v("--ds-text-primary", "#dfe1e5");
  return {
    background: v("--ds-surface-editor", "#1e1f22"),
    foreground: fg,
    cursor: v("--ds-accent", "#3fb6a8"),
    cursorAccent: v("--ds-surface-editor", "#1e1f22"),
    green: v("--ds-success", "#3e8c49"),
    brightGreen: v("--ds-success", "#3e8c49"),
  };
}

/**
 * One real shell terminal (road-to-actually-works P6) — an xterm.js instance
 * bound to the sidecar `terminal` provider for `id`. Subscribes BEFORE open to
 * catch the shell's first prompt; pipes provider output → xterm and keystrokes
 * → provider.write; propagates resize. The login shell runs in the active
 * worktree (a real LOCAL terminal on desktop; the deterministic mock transcript
 * in the browser). jsdom-safe: the xterm lifecycle is guarded so the unit-test
 * render of the panel never throws (real layout only exists in a browser).
 */
function TerminalView({
  id,
  active,
  reduced,
}: {
  id: string;
  active: boolean;
  reduced: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const fitRef = React.useRef<FitAddon | null>(null);
  const termRef = React.useRef<Xterm | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const term = getProviders().terminal;
    // cwd snapshot at mount: active worktree → open project root → shell default.
    const cwd =
      useWorktrees.getState().activePath || useOpenProject.getState().project?.path || "";

    let xterm: Xterm | undefined;
    let off: (() => void) | undefined;
    let dataSub: { dispose(): void } | undefined;
    let ro: ResizeObserver | undefined;
    try {
      xterm = new Xterm({
        cursorBlink: !reduced,
        fontFamily:
          getComputedStyle(el).getPropertyValue("--ds-font-mono").trim() || "monospace",
        fontSize: 13,
        theme: readXtermTheme(el),
        scrollback: 5000,
        convertEol: false,
      });
      const fit = new FitAddon();
      xterm.loadAddon(fit);
      xterm.open(el);
      fitRef.current = fit;
      termRef.current = xterm;

      // Subscribe BEFORE open so the shell's first output (the prompt) is caught.
      off = term.subscribe(id, (event) => {
        if (event.kind === "data") xterm?.write(event.data);
        else
          xterm?.write(
            `\r\n\x1b[2m[process exited${event.exitCode != null ? ` (${event.exitCode})` : ""}]\x1b[0m\r\n`,
          );
      });
      dataSub = xterm.onData((d) => void term.write(id, d));

      const safeFit = (): void => {
        try {
          fit.fit();
          if (xterm) void term.resize(id, xterm.cols, xterm.rows);
        } catch {
          /* no real layout (jsdom / hidden) — fit is a no-op */
        }
      };
      safeFit();
      void term.open({ id, cwd, cols: xterm.cols, rows: xterm.rows }).then(safeFit);

      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(safeFit);
        ro.observe(el);
      }
    } catch {
      // jsdom (no canvas/layout) or a transient xterm failure — degrade to an
      // empty panel instead of crashing the surrounding shell render.
    }

    return () => {
      ro?.disconnect();
      dataSub?.dispose();
      off?.();
      void term.close(id);
      xterm?.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // Bind once per terminal id; worktree switches do not re-spawn an open shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // On activation, re-fit to the now-visible size and focus for typing.
  React.useEffect(() => {
    if (!active) return;
    try {
      fitRef.current?.fit();
      const x = termRef.current;
      if (x) {
        void getProviders().terminal.resize(id, x.cols, x.rows);
        x.focus();
      }
    } catch {
      /* not laid out yet */
    }
  }, [active, id]);

  return (
    <div
      ref={ref}
      data-testid={`term-view-${id}`}
      className={"term-view h-full w-full" + (active ? "" : " hidden")}
    />
  );
}

/**
 * Bottom terminal panel — 1:1 port of the prototype `Terminal` (panels.jsx):
 * `.term-tabbar` (tools + tabs), `.term-body` with `.t-line`/`.t-prompt`/
 * `.t-dim`/`.t-ok` + a blinking `.t-caret` (honours prefers-reduced-motion).
 * Renameable tabs, close ×, +, split/kill — app logic + testids preserved.
 */
export function Terminal() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [tabs, setTabs] = React.useState<TermTab[]>(INITIAL_TABS);
  const [active, setActive] = React.useState<string>("evidence");
  const [counter, setCounter] = React.useState(1);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const editRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) editRef.current?.select();
  }, [editing]);

  const close = (id: string) => {
    setTabs((ts) => {
      const next = ts.filter((x) => x.id !== id);
      setActive((a) => (a === id ? (next[next.length - 1]?.id ?? "") : a));
      return next;
    });
  };

  const addTab = () => {
    const id = `term-${counter}`;
    setCounter((c) => c + 1);
    setTabs((ts) => [...ts, { id, label: t("terminal.session", { n: counter }), panes: [id] }]);
    setActive(id);
  };

  // Split the active tab into two side-by-side PTYs (toggle). The second pane is
  // a distinct PTY id; mounting/unmounting its TerminalView spawns/reaps it.
  const splitActive = () => {
    setTabs((ts) =>
      ts.map((x) =>
        x.id === active
          ? { ...x, panes: x.panes.length < 2 ? [...x.panes, `${x.id}:split`] : [x.panes[0]] }
          : x,
      ),
    );
  };

  const startRename = (tab: TermTab) => {
    setDraft(tab.label);
    setEditing(tab.id);
  };

  const commitRename = (id: string) => {
    const next = draft.trim();
    if (next) setTabs((ts) => ts.map((x) => (x.id === id ? { ...x, label: next } : x)));
    setEditing(null);
  };

  return (
    <div data-testid="terminal" className="terminal border-t border-border">
      <div className="term-tabbar">
        <div className="term-tools">
          <span className="term-label">
            <Icon icon={SquareTerminal} size={14} className="text-muted-foreground" />
          </span>
          <button
            type="button"
            aria-label={t("terminal.split")}
            title={t("terminal.split")}
            data-testid="term-split"
            onClick={() => active && splitActive()}
            className="ph-act focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Icon icon={SplitSquareHorizontal} size={13} />
          </button>
          <button
            type="button"
            aria-label={t("terminal.kill")}
            title={t("terminal.kill")}
            data-testid="term-kill"
            onClick={() => active && close(active)}
            className="ph-act focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Icon icon={Trash2} size={13} />
          </button>
        </div>
        <div role="toolbar" aria-label={t("terminal.tabsLabel")} className="term-tabs">
          {tabs.map((tab) => {
            const isActive = tab.id === active;
            return (
              <div
                key={tab.id}
                data-testid={`term-tab-${tab.id}`}
                data-active={isActive || undefined}
                onDoubleClick={() => startRename(tab)}
                className={"term-tab group" + (isActive ? " active" : "")}
              >
                {editing === tab.id ? (
                  <input
                    ref={editRef}
                    data-testid={`term-rename-${tab.id}`}
                    aria-label={t("terminal.rename")}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => commitRename(tab.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(tab.id);
                      else if (e.key === "Escape") setEditing(null);
                    }}
                    className="w-24 rounded-sm border border-border bg-muted px-1 text-ui text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                ) : (
                  <button
                    type="button"
                    aria-pressed={isActive}
                    data-testid={`term-select-${tab.id}`}
                    onClick={() => setActive(tab.id)}
                    className="bg-transparent text-inherit focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    {tab.label}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={t("terminal.close")}
                  title={t("terminal.close")}
                  data-testid={`term-close-${tab.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    close(tab.id);
                  }}
                  className="term-x focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <Icon icon={X} size={12} />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            aria-label={t("terminal.newTab")}
            title={t("terminal.newTab")}
            data-testid="term-new"
            onClick={addTab}
            className="term-tab term-add focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Icon icon={Plus} size={14} />
          </button>
        </div>
      </div>
      <div data-testid="terminal-output" className="term-body">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const split = tab.panes.length > 1;
          return (
            <div
              key={tab.id}
              data-testid={`term-tabview-${tab.id}`}
              data-split={split || undefined}
              className={"flex h-full w-full" + (isActive ? "" : " hidden")}
            >
              {tab.panes.map((paneId, i) => (
                <div
                  key={paneId}
                  className={"min-w-0 flex-1" + (i > 0 ? " border-l border-border" : "")}
                >
                  <TerminalView id={paneId} active={isActive} reduced={reduced} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Draggable splitter that resizes the terminal height (persisted). */
export function TerminalSplitter() {
  const { t } = useTranslation();
  const terminalHeight = useLayout((s) => s.terminalHeight);
  const setTerminalHeight = useLayout((s) => s.setTerminalHeight);

  const clamp = (h: number) => Math.max(90, Math.min(window.innerHeight - 280, h));

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = terminalHeight;
    const move = (ev: PointerEvent) => setTerminalHeight(clamp(startH - (ev.clientY - startY)));
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setTerminalHeight(clamp(terminalHeight + 16));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setTerminalHeight(clamp(terminalHeight - 16));
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={t("terminal.resize")}
      aria-valuenow={Math.round(terminalHeight)}
      aria-valuemin={90}
      aria-valuemax={800}
      tabIndex={0}
      data-testid="terminal-splitter"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="group relative h-[7px] shrink-0 cursor-row-resize bg-border hover:bg-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <span className="absolute left-1/2 top-1/2 h-[3px] w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/50 group-hover:bg-primary" />
    </div>
  );
}
