import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, SplitSquareHorizontal, SquareTerminal, Trash2, X } from "lucide-react";
import { Icon } from "@/components/icon";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useLayout } from "./store";

interface TermTab {
  id: string;
  label: string;
}

/** Deterministic terminal transcript (no Date.now / Math.random). */
const LINES: { kind: "cmd" | "dim" | "ok"; text: string }[] = [
  { kind: "cmd", text: "~/dev/capisco ❯ pnpm test core/broker" },
  { kind: "dim", text: "$ vitest run src/core/broker.test.ts" },
  { kind: "ok", text: "broker · grants scoped capability once (4 ms)" },
  { kind: "ok", text: "broker · denies revoked principal (2 ms)" },
  { kind: "ok", text: "broker · escalates to prompt on unknown scope (6 ms)" },
  { kind: "dim", text: "Test Files  1 passed (1)" },
  { kind: "ok", text: "3 passed · 312ms" },
];

const INITIAL_TABS: TermTab[] = [
  { id: "local", label: "Local" },
  { id: "py2ts", label: "Py2Ts" },
  { id: "evidence", label: "Evidence" },
];

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
    setTabs((ts) => [...ts, { id, label: t("terminal.session", { n: counter }) }]);
    setActive(id);
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
        {LINES.map((l, i) => (
          <div key={i} className={"t-line" + (l.kind === "dim" ? " t-dim" : "")}>
            {l.kind === "ok" && <span className="t-ok">✓ </span>}
            {l.text}
          </div>
        ))}
        <div className="t-line">
          <span className="t-prompt">❯</span>{" "}
          <span data-testid="terminal-caret" data-reduced={reduced || undefined} className="t-caret" aria-hidden />
        </div>
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
