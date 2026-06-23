import * as React from "react";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, SquareKanban, X } from "lucide-react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { tasksSnapshot } from "@/mocks/tasks";
import { useLayout } from "@/shell/store";
import { usePalette } from "@/shell/command-registry";
import type { Ticket } from "@/contracts";
import { TaskOverview } from "./TaskOverview";
import { TicketDetail } from "./TicketDetail";

/**
 * Tasks center workspace (build-spec §6, roadmap R5 Phase 1). A tabbar with an
 * always-present Overview tab plus a closable detail tab per opened ticket
 * (prototype TaskDashboard). Open-ticket state is workspace-local (it does not
 * survive reload — matching the prototype). Closing the active tab falls back
 * to Overview.
 */
export function TasksWorkspace() {
  const { t } = useTranslation();
  const setMode = useLayout((s) => s.setMode);
  const register = usePalette((s) => s.register);
  const [open, setOpen] = React.useState<string[]>([]);
  const [view, setView] = React.useState<string>("overview");

  // Self-register the Tasks-workspace action in the palette (escalation ladder).
  React.useEffect(() => {
    return register({
      id: "tasks:open",
      group: "view",
      icon: SquareKanban,
      label: t("tasks.command.open"),
      run: () => setMode("tasks"),
    });
  }, [register, t, setMode]);

  const openTicket = (ticket: Ticket) => {
    setOpen((o) => (o.includes(ticket.id) ? o : [...o, ticket.id]));
    setView(ticket.id);
  };
  const closeTicket = (id: string) => {
    setOpen((o) => o.filter((x) => x !== id));
    setView((v) => (v === id ? "overview" : v));
  };

  const activeTicket = view !== "overview" ? tasksSnapshot.getTicket(view) : undefined;

  return (
    <div data-testid="tasks-workspace" className="tk-workspace min-w-0">
      <div
        data-testid="tasks-tabbar"
        role="tablist"
        aria-label={t("tasks.workspaceTabs")}
        className="tk-tabbar"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "overview"}
          data-testid="tasks-tab-overview"
          onClick={() => setView("overview")}
          className={cn("tk-tab", view === "overview" && "active")}
        >
          <Icon icon={LayoutDashboard} size={13} />
          {t("tasks.overview")}
        </button>
        {open.map((id) => (
          <div
            key={id}
            data-testid={`tasks-tab-${id}`}
            className={cn("tk-tab group", view === id && "active")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === id}
              data-testid={`tasks-tab-select-${id}`}
              onClick={() => setView(id)}
              className="tk-tabid bg-transparent text-inherit focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {id}
            </button>
            <button
              type="button"
              aria-label={t("tasks.closeTab", { id })}
              data-testid={`tasks-tab-close-${id}`}
              onClick={() => closeTicket(id)}
              className="tk-tabx focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Icon icon={X} size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="tk-tabbody" role="tabpanel">
        {activeTicket ? (
          <TicketDetail ticket={activeTicket} />
        ) : (
          <TaskOverview onOpenTicket={openTicket} />
        )}
      </div>
    </div>
  );
}
