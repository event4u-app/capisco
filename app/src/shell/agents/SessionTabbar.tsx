import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Settings, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/capisco/status-dot";
import { ModelBadge } from "@/components/capisco/model-badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { mockAgentProvider } from "@/mocks";
import type { Session } from "@/contracts";

function SessionTab({
  s,
  active,
  onSelect,
  onClose,
}: {
  s: Session;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // The outer element is layout-only (no interactive role) so the selectable
  // tab button and the close button are siblings — never nested interactives
  // (axe nested-interactive). The select button carries role=tab.
  return (
    <div
      data-testid={`session-tab-${s.id}`}
      className={cn(
        "group flex max-w-[320px] items-stretch whitespace-nowrap border-r border-border",
        active && "bg-editor shadow-[inset_0_2px_0_0_hsl(var(--primary))]",
      )}
    >
      <button
        type="button"
        aria-pressed={active}
        data-testid={`session-select-${s.id}`}
        onClick={onSelect}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 pl-3.5 pr-1.5 text-muted-foreground",
          "hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
          active && "bg-editor text-foreground hover:bg-editor",
        )}
      >
        <StatusDot status={s.status} />
        <ModelBadge spotlight={active}>{s.model}</ModelBadge>
        <span className="overflow-hidden text-ellipsis text-ui">{s.title}</span>
        <span
          data-testid={`session-meta-${s.id}`}
          className="whitespace-nowrap font-mono text-[10.5px] text-muted-foreground"
        >
          {s.meta}
        </span>
      </button>
      <button
        type="button"
        aria-label={t("agents.tabbar.closeSession")}
        data-testid={`session-close-${s.id}`}
        onClick={onClose}
        className={cn(
          "mr-2 flex items-center rounded-sm px-0.5 text-muted-foreground opacity-0 transition-opacity",
          "hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100",
        )}
      >
        <X className="size-3.5" strokeWidth={1.6} />
      </button>
    </div>
  );
}

function NewSessionButton({ onCreate }: { onCreate: (model: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const agents = mockAgentProvider.listAgents();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("agents.tabbar.newSession")}
          data-testid="session-new"
          className="flex w-9 shrink-0 items-center justify-center border-l border-border text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Plus className="size-4" strokeWidth={1.6} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-44 p-1"
        data-testid="session-new-menu"
      >
        <div className="px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("agents.tabbar.newSessionWith")}
        </div>
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            data-testid={`session-new-opt-${a.id}`}
            onClick={() => {
              onCreate(a.label);
              setOpen(false);
            }}
            className="flex h-6 w-full items-center rounded-sm px-2 text-left text-ui text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {a.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function SessionTabbar({
  sessions,
  activeId,
  onSelect,
  onClose,
  onCreate,
  settingsOpen,
  onToggleSettings,
}: {
  sessions: Session[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onCreate: (model: string) => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="session-tabbar"
      className="flex h-[var(--tabbar-h)] shrink-0 items-stretch border-b border-border bg-card"
      role="toolbar"
      aria-label={t("agents.tabbar.label")}
    >
      <div className="flex flex-1 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sessions.map((s) => (
          <SessionTab
            key={s.id}
            s={s}
            active={activeId === s.id}
            onSelect={() => onSelect(s.id)}
            onClose={() => onClose(s.id)}
          />
        ))}
      </div>
      <NewSessionButton onCreate={onCreate} />
      <button
        type="button"
        aria-label={t("agents.tabbar.settings")}
        aria-pressed={settingsOpen}
        data-testid="session-gear"
        onClick={onToggleSettings}
        className={cn(
          "flex w-10 shrink-0 items-center justify-center border-l border-border text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          settingsOpen && "bg-primary/10 text-primary",
        )}
      >
        <Settings className="size-4" strokeWidth={1.6} />
      </button>
    </div>
  );
}

export { SessionTab };
