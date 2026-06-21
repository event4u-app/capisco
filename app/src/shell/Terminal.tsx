import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, SplitSquareHorizontal, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
 * Bottom terminal panel (build-spec §7 / roadmap Phase 2). Renameable tabs
 * (double-click), close ×, `+`, split/kill icons, a deterministic mock run with
 * green checks, and a blinking caret prompt that honours prefers-reduced-motion.
 * Static styled output — xterm.js is optional for this UI shell.
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
    <div
      data-testid="terminal"
      className="flex min-h-0 flex-col border-t border-border bg-muted"
    >
      <div className="flex h-[30px] shrink-0 items-center border-b border-border bg-card">
        <div
          role="toolbar"
          aria-label={t("terminal.tabsLabel")}
          className="flex items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const isActive = tab.id === active;
            return (
              <div
                key={tab.id}
                data-testid={`term-tab-${tab.id}`}
                data-active={isActive || undefined}
                onDoubleClick={() => startRename(tab)}
                className={cn(
                  "group flex items-center gap-1 border-r border-border pr-1.5 text-ui",
                  isActive
                    ? "bg-muted text-foreground shadow-[inset_0_2px_0_0_hsl(var(--primary))]"
                    : "text-muted-foreground hover:text-foreground",
                )}
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
                    className="ml-2.5 w-24 rounded-sm border border-border bg-muted px-1 text-ui text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                ) : (
                  <button
                    type="button"
                    aria-pressed={isActive}
                    data-testid={`term-select-${tab.id}`}
                    onClick={() => setActive(tab.id)}
                    className="cursor-pointer pl-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
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
                  className="flex size-3.5 items-center justify-center rounded-sm text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100"
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
            className="flex items-center px-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Icon icon={Plus} size={14} />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-end gap-0.5 px-2 text-muted-foreground">
          <button
            type="button"
            aria-label={t("terminal.split")}
            title={t("terminal.split")}
            data-testid="term-split"
            className="flex size-5 items-center justify-center rounded-sm hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Icon icon={SplitSquareHorizontal} size={14} />
          </button>
          <button
            type="button"
            aria-label={t("terminal.kill")}
            title={t("terminal.kill")}
            data-testid="term-kill"
            onClick={() => active && close(active)}
            className="flex size-5 items-center justify-center rounded-sm hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Icon icon={Trash2} size={14} />
          </button>
        </div>
      </div>
      <div
        data-testid="terminal-output"
        className="min-h-0 flex-1 overflow-auto p-2 font-mono text-code leading-relaxed"
      >
        {LINES.map((l, i) => (
          <div
            key={i}
            className={cn(l.kind === "dim" && "text-muted-foreground", l.kind === "ok" && "text-foreground")}
          >
            {l.kind === "ok" && <span className="text-success">✓ </span>}
            {l.text}
          </div>
        ))}
        <div className="flex items-center text-foreground">
          <span className="text-primary">❯</span>
          <span
            data-testid="terminal-caret"
            data-reduced={reduced || undefined}
            className={cn(
              "ml-1 inline-block h-[1.1em] w-[7px] bg-foreground align-middle",
              reduced ? "opacity-100" : "animate-capisco-blink",
            )}
            aria-hidden
          />
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
