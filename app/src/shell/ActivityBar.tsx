import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Bot,
  FileCode2,
  GitBranch,
  MessageSquare,
  SquareKanban,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { railItem } from "./tools";
import {
  TERMINAL_ID,
  useLayout,
  type RailGroup,
  type WorkspaceMode,
} from "./store";

const DND_TYPE = "application/x-capisco-tool";

const MODES: { id: WorkspaceMode; icon: LucideIcon; labelKey: string }[] = [
  { id: "agents", icon: Bot, labelKey: "mode.agents" },
  { id: "chat", icon: MessageSquare, labelKey: "mode.chat" },
  { id: "editor", icon: FileCode2, labelKey: "mode.editor" },
  { id: "git", icon: GitBranch, labelKey: "mode.git" },
  { id: "tasks", icon: SquareKanban, labelKey: "mode.tasks" },
];

/**
 * A single draggable rail item. It is BOTH a drag source and a drop target:
 * dropping another item onto it inserts the dragged item immediately before it
 * (reorder within a group / move across groups + rails). The persistent
 * state machine lives in the store; this component only emits intents.
 */
function RailItem({
  id,
  group,
  side,
  active,
  onActivate,
}: {
  id: string;
  group: RailGroup;
  side: "left" | "right";
  active: boolean;
  onActivate: () => void;
}) {
  const { t } = useTranslation();
  const reorder = useLayout((s) => s.reorder);
  const { icon: I, labelKey } = railItem(id);
  const label = t(labelKey);
  const [over, setOver] = React.useState(false);

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      data-testid={`rail-item-${id}`}
      data-drop-over={over || undefined}
      draggable
      onClick={onActivate}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_TYPE, id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DND_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        const dragId = e.dataTransfer.getData(DND_TYPE);
        if (dragId && dragId !== id) reorder(dragId, group, id);
      }}
      className={cn(
        "relative flex h-12 w-12 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
        active && "bg-accent text-foreground",
        over && "ring-1 ring-inset ring-primary",
      )}
    >
      {active && (
        <span
          className={cn(
            "absolute inset-y-1.5 w-0.5 bg-primary",
            side === "left" ? "left-0" : "right-0",
          )}
        />
      )}
      <I className="size-[18px]" strokeWidth={1.6} aria-hidden />
      <span className="text-[9px] leading-none">{label}</span>
    </button>
  );
}

/** Flexible drop zone that appends a dropped tool to the END of `group`. */
function GroupDropZone({
  group,
  flex,
  emptyDashed,
  testid,
}: {
  group: RailGroup;
  flex: boolean;
  emptyDashed?: boolean;
  testid: string;
}) {
  const { t } = useTranslation();
  const reorder = useLayout((s) => s.reorder);
  const [over, setOver] = React.useState(false);
  return (
    <div
      role="group"
      data-testid={testid}
      data-drop-over={over || undefined}
      aria-label={t("rail.dropZone")}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DND_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const dragId = e.dataTransfer.getData(DND_TYPE);
        if (dragId) reorder(dragId, group, null);
      }}
      className={cn(
        flex ? "flex-1" : "min-h-12 shrink-0",
        emptyDashed && "mx-1.5 my-1 rounded-sm border border-dashed border-border/70",
        emptyDashed && "flex items-center justify-center",
        over && "bg-accent/60",
        over && emptyDashed && "border-primary",
      )}
    >
      {emptyDashed && (
        <span className="select-none text-[9px] leading-tight text-muted-foreground">
          {t("rail.dock")}
        </span>
      )}
    </div>
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
        side={side}
        active={isTerm ? terminalOpen : isActive}
        onActivate={isTerm ? toggleTerminal : () => select(id)}
      />
    );
  };

  if (side === "left") {
    const top = visible(groups.leftTop);
    const bottom = visible(groups.leftBottom);
    return (
      <nav
        data-testid="activity-left"
        aria-label={t("rail.leftTools")}
        className="flex flex-col border-r border-border bg-card"
      >
        {top.map((id) => renderItem(id, "leftTop", topActive === id))}
        <GroupDropZone group="leftTop" flex testid="rail-fill-left" />
        {bottom.map((id) => renderItem(id, "leftBottom", botActive === id))}
        <GroupDropZone
          group="leftBottom"
          flex={false}
          emptyDashed={bottom.length === 0}
          testid="rail-bottom-drop-left"
        />
      </nav>
    );
  }

  const top = visible(groups.rightTop);
  const bottom = visible(groups.rightBottom);
  return (
    <nav
      data-testid="activity-right"
      aria-label={t("rail.rightTools")}
      className="flex flex-col border-l border-border bg-card"
    >
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          title={t(m.labelKey)}
          aria-label={t(m.labelKey)}
          aria-pressed={mode === m.id}
          data-testid={`mode-${m.id}`}
          onClick={() => setMode(m.id)}
          className={cn(
            "relative flex h-12 w-12 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
            mode === m.id && "bg-accent text-foreground",
          )}
        >
          {mode === m.id && <span className="absolute inset-y-1.5 right-0 w-0.5 bg-primary" />}
          <m.icon className="size-[18px]" strokeWidth={1.6} aria-hidden />
          <span className="text-[9px] leading-none">{t(m.labelKey)}</span>
        </button>
      ))}
      <div className="my-1 border-t border-border" />
      {top.map((id) => renderItem(id, "rightTop", rTopActive === id))}
      <GroupDropZone group="rightTop" flex testid="rail-fill-right" />
      {bottom.map((id) => renderItem(id, "rightBottom", rBotActive === id))}
      <GroupDropZone
        group="rightBottom"
        flex={false}
        emptyDashed={bottom.length === 0}
        testid="rail-bottom-drop-right"
      />
    </nav>
  );
}
