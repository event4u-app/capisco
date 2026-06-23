import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Bot,
  GitGraph,
  Kanban,
  MessageSquare,
  SquareCode,
  SquareTerminal,
  type LucideIcon,
} from "lucide-react";
import { railItem } from "./tools";
import {
  TERMINAL_ID,
  useLayout,
  type RailGroup,
  type WorkspaceMode,
} from "./store";

/** Prototype drag payload key (chrome.jsx) — verbatim. */
const DND_TYPE = "cap-tool";

const MODES: { id: WorkspaceMode; icon: LucideIcon; labelKey: string }[] = [
  { id: "agents", icon: Bot, labelKey: "mode.agents" },
  { id: "chat", icon: MessageSquare, labelKey: "mode.chat" },
  { id: "editor", icon: SquareCode, labelKey: "mode.editor" },
  { id: "git", icon: GitGraph, labelKey: "mode.git" },
  { id: "tasks", icon: Kanban, labelKey: "mode.tasks" },
];

/**
 * A single rail item — 1:1 port of the prototype `LeftItem` (chrome.jsx). The
 * `.ab-itemwrap` is the drop target (drop-before); the inner `.ab-item` is the
 * drag source. `ab-over` highlights the insert point. Markup + classes verbatim;
 * styling lives in styles/capisco-composer.css (the prototype `.ab-*` rules).
 */
function RailItem({
  id,
  group,
  active,
  onActivate,
}: {
  id: string;
  group: RailGroup;
  active: boolean;
  onActivate: () => void;
}) {
  const { t } = useTranslation();
  const reorder = useLayout((s) => s.reorder);
  const isTerm = id === TERMINAL_ID;
  const Icon = isTerm ? SquareTerminal : railItem(id).icon;
  const label = isTerm ? t("rail.terminal") : t(railItem(id).labelKey);
  const [over, setOver] = React.useState(false);

  return (
    <div
      className="ab-itemwrap"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DND_TYPE)) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const d = e.dataTransfer.getData(DND_TYPE);
        if (d && d !== id) reorder(d, group, id);
      }}
    >
      <button
        type="button"
        className={"ab-item" + (active ? " active" : "") + (over ? " ab-over" : "")}
        title={label}
        aria-label={label}
        aria-pressed={active}
        data-testid={`rail-item-${id}`}
        draggable
        onClick={onActivate}
        onDragStart={(e) => {
          e.dataTransfer.setData(DND_TYPE, id);
          e.dataTransfer.effectAllowed = "move";
        }}
      >
        <Icon size={18} strokeWidth={1.6} aria-hidden />
        <span className="ab-label">{label}</span>
      </button>
    </div>
  );
}

/**
 * The flexible top spacer (`.ab-fill`) and the bottom drop zone (`.ab-fillbottom`).
 * Dropping on the fill appends to the top group's end; the fillbottom shows the
 * dashed icon-sized placeholder ONLY while its group is empty (prototype). Drop
 * highlight via the `ab-filldrop` class (toggled on the element, like the proto).
 */
function FillZone({
  group,
  variant,
  empty,
  testid,
}: {
  group: RailGroup;
  variant: "fill" | "bottom";
  empty?: boolean;
  testid: string;
}) {
  const reorder = useLayout((s) => s.reorder);
  // Plain div, no aria-label — matches the prototype (.ab-fill/.ab-fillbottom
  // are decorative drag targets) and avoids aria-prohibited-attr.
  const base = variant === "fill" ? "ab-fill" : "ab-fillbottom" + (empty ? "" : " filled");
  return (
    <div
      data-testid={testid}
      className={base}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DND_TYPE)) {
          e.preventDefault();
          e.currentTarget.classList.add("ab-filldrop");
        }
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("ab-filldrop")}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("ab-filldrop");
        const d = e.dataTransfer.getData(DND_TYPE);
        if (d) reorder(d, group, null);
      }}
    />
  );
}

export function ActivityBar({ side }: { side: "left" | "right" }) {
  const { t } = useTranslation();
  const groups = useLayout((s) => s.groups);
  const hiddenTools = useLayout((s) => s.hiddenTools);
  const topActive = useLayout((s) => s.topActive);
  const botActive = useLayout((s) => s.botActive);
  const rTopActive = useLayout((s) => s.rTopActive);
  const rBotActive = useLayout((s) => s.rBotActive);
  const select = useLayout((s) => s.select);
  const mode = useLayout((s) => s.mode);
  const setMode = useLayout((s) => s.setMode);
  const terminalOpen = useLayout((s) => s.terminalOpen);
  const toggleTerminal = useLayout((s) => s.toggleTerminal);

  const visible = (ids: string[]) =>
    ids.filter((id) => id === TERMINAL_ID || !hiddenTools.includes(id));

  const renderItem = (id: string, group: RailGroup, isActive: boolean) => {
    const isTerm = id === TERMINAL_ID;
    return (
      <RailItem
        key={id}
        id={id}
        group={group}
        active={isTerm ? terminalOpen : isActive}
        onActivate={isTerm ? toggleTerminal : () => select(id)}
      />
    );
  };

  if (side === "left") {
    const top = visible(groups.leftTop);
    const bottom = visible(groups.leftBottom);
    return (
      <nav className="activitybar left" data-testid="activity-left" aria-label={t("rail.leftTools")}>
        {top.map((id) => renderItem(id, "leftTop", topActive === id))}
        <FillZone group="leftTop" variant="fill" testid="rail-fill-left" />
        {bottom.map((id) => renderItem(id, "leftBottom", botActive === id))}
        <FillZone
          group="leftBottom"
          variant="bottom"
          empty={bottom.length === 0}
          testid="rail-bottom-drop-left"
        />
      </nav>
    );
  }

  const top = visible(groups.rightTop);
  const bottom = visible(groups.rightBottom);
  return (
    <nav className="activitybar right" data-testid="activity-right" aria-label={t("rail.rightTools")}>
      <div className="ab-top-fixed">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={"ab-item" + (mode === m.id ? " active" : "")}
            title={t(m.labelKey)}
            aria-label={t(m.labelKey)}
            aria-pressed={mode === m.id}
            data-testid={`mode-${m.id}`}
            onClick={() => setMode(m.id)}
          >
            <m.icon size={18} strokeWidth={1.6} aria-hidden />
            <span className="ab-label">{t(m.labelKey)}</span>
          </button>
        ))}
      </div>
      <div className="ab-div" />
      {top.map((id) => renderItem(id, "rightTop", rTopActive === id))}
      <FillZone group="rightTop" variant="fill" testid="rail-fill-right" />
      {bottom.map((id) => renderItem(id, "rightBottom", rBotActive === id))}
      <FillZone
        group="rightBottom"
        variant="bottom"
        empty={bottom.length === 0}
        testid="rail-bottom-drop-right"
      />
    </nav>
  );
}
