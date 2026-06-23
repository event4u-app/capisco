import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Settings, X } from "lucide-react";

import { StatusDot } from "@/components/capisco/status-dot";
import { ModelBadge } from "@/components/capisco/model-badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { agentSnapshot } from "@/mocks";
import type { Session } from "@/contracts";
import { formatTelemetry, effectiveModel } from "./store";

function SessionTab({
  s,
  active,
  onSelect,
  onClose,
  modelOverrides,
}: {
  s: Session;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  /** Per-session human model overrides (Phase 4) — the badge shows the effective model. */
  modelOverrides: Record<string, string>;
}) {
  const { t } = useTranslation();
  // The outer element is layout-only (no interactive role) so the selectable
  // tab button and the close button are siblings — never nested interactives
  // (axe nested-interactive). The select button carries role=tab.
  // Prototype `.session-tab` (verbatim CSS): the active teal strip is a
  // continuous `border-top` on the tab element (never covered by a child bg —
  // that was the "broken strip" bug). The select/close split stays for a11y
  // (no nested interactives).
  return (
    <div
      data-testid={`session-tab-${s.id}`}
      className={"session-tab group" + (active ? " active" : "")}
    >
      <button
        type="button"
        aria-pressed={active}
        data-testid={`session-select-${s.id}`}
        onClick={onSelect}
        className="session-tab-select focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <StatusDot status={s.status} />
        <ModelBadge spotlight={active}>{effectiveModel(s, modelOverrides)}</ModelBadge>
        {/* Session/chat titles trim with an ellipsis at 160px (.st-title). */}
        <span data-testid={`session-title-${s.id}`} className="st-title">
          {s.title}
        </span>
        <span data-testid={`session-meta-${s.id}`} className="st-meta">
          {formatTelemetry(s.telemetry, s.status)}
        </span>
      </button>
      <button
        type="button"
        aria-label={t("agents.tabbar.closeSession")}
        data-testid={`session-close-${s.id}`}
        onClick={onClose}
        className="st-x focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <X className="size-3.5" strokeWidth={1.6} />
      </button>
    </div>
  );
}

function NewSessionButton({ onCreate }: { onCreate: (model: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const agents = agentSnapshot.agents;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("agents.tabbar.newSession")}
          data-testid="session-new"
          className="session-add focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
  modelOverrides = {},
}: {
  sessions: Session[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onCreate: (model: string) => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  /** Per-session human model overrides (Phase 4); defaults to none (golden-safe). */
  modelOverrides?: Record<string, string>;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="session-tabbar"
      className="session-tabbar"
      role="toolbar"
      aria-label={t("agents.tabbar.label")}
    >
      <div className="session-tabs">
        {sessions.map((s) => (
          <SessionTab
            key={s.id}
            s={s}
            active={activeId === s.id}
            onSelect={() => onSelect(s.id)}
            onClose={() => onClose(s.id)}
            modelOverrides={modelOverrides}
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
        className={"session-gear focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" + (settingsOpen ? " active" : "")}
      >
        <Settings className="size-4" strokeWidth={1.6} />
      </button>
    </div>
  );
}

export { SessionTab };
