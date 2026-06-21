import * as React from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Folder, Play, RefreshCw, SquareTerminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import type { ContainerStatus, ServiceStat } from "@/contracts";
import { mockContainerGroups } from "@/mocks";
import { PanelHead, PanelHeadAction } from "./PanelHead";

/** Status dot colour role per container status (token roles, no hardcoded hex). */
function statusDotClass(status: ContainerStatus): string {
  switch (status) {
    case "running":
      return "bg-success";
    case "error":
      return "bg-error";
    case "exited":
      return "bg-muted-foreground";
  }
}

/**
 * Services panel (build-spec §3 / §4.8) — ctop-style container management
 * GROUPED BY loaded project. Each group is a sticky dark header carrying an
 * `N/M up` count; each row shows a status dot, name, image, a CPU bar, mem,
 * ports, and an `exec -it` console action. Feeds from `ContainerGroup` /
 * `ServiceStat` (mock). Sticky group headers pin while their services scroll.
 */
export function ServicesPanel() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());

  const toggle = React.useCallback((project: string) => {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(project)) next.delete(project);
      else next.add(project);
      return next;
    });
  }, []);

  const empty = mockContainerGroups.length === 0;

  return (
    <div data-testid="services-panel" className="flex h-full min-h-0 flex-col">
      <PanelHead title={t("services.head")}>
        <PanelHeadAction icon={Play} label={t("services.startAll")} />
        <PanelHeadAction icon={RefreshCw} label={t("services.refresh")} />
      </PanelHead>
      {empty ? (
        <p data-testid="services-empty" className="px-3 py-2 text-micro text-muted-foreground">
          {t("services.empty")}
        </p>
      ) : (
        <div data-testid="services-list" className="min-h-0 flex-1 overflow-auto">
          {mockContainerGroups.map((g) => {
            const running = g.services.filter((s) => s.status === "running").length;
            const open = !collapsed.has(g.project);
            return (
              <div key={g.project}>
                <button
                  type="button"
                  data-testid={`services-group-${g.project}`}
                  aria-expanded={open}
                  onClick={() => toggle(g.project)}
                  className="sticky top-0 z-10 flex h-[26px] w-full cursor-pointer items-center gap-1.5 border-y border-border bg-secondary px-2 text-left shadow-[0_1px_0_rgba(0,0,0,0.25)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <ChevronRight
                    className={cn(
                      "size-3 shrink-0 text-muted-foreground transition-transform",
                      open && "rotate-90",
                    )}
                    strokeWidth={1.8}
                    aria-hidden
                  />
                  <Icon icon={Folder} size={13} className="shrink-0 text-muted-foreground" />
                  <span className="truncate text-ui font-medium text-foreground">{g.project}</span>
                  <span
                    data-testid={`services-count-${g.project}`}
                    className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground"
                  >
                    {running}/{g.services.length} up
                  </span>
                </button>
                {open && g.services.map((s) => <ServiceRowView key={s.name} service={s} />)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ServiceRowView({ service: c }: { service: ServiceStat }) {
  const { t } = useTranslation();
  const isRunning = c.status === "running";
  return (
    <div
      data-testid={`services-row-${c.name}`}
      className="flex items-start gap-2 px-2.5 py-2 hover:bg-accent"
    >
      <span
        data-testid={`services-dot-${c.name}`}
        className={cn("mt-1 size-2 shrink-0 rounded-full", statusDotClass(c.status))}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-ui font-medium text-foreground">{c.name}</span>
          <span className="truncate font-mono text-[10.5px] text-muted-foreground">{c.image}</span>
        </div>
        <div
          data-testid={`services-meta-${c.name}`}
          className="mt-0.5 truncate font-mono text-micro text-muted-foreground"
        >
          {isRunning ? (
            <>
              <b className="font-semibold text-primary">{c.cpu}%</b> {t("services.cpu")} · {c.mem} ·{" "}
              {c.ports}
            </>
          ) : (
            t(`services.status.${c.status}`)
          )}
        </div>
        {isRunning && (
          <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-secondary">
            <div
              data-testid={`services-cpubar-${c.name}`}
              className="h-full rounded-full bg-primary"
              style={{ width: `${c.cpu}%` }}
            />
          </div>
        )}
      </div>
      <button
        type="button"
        data-testid={`services-console-${c.name}`}
        aria-label={isRunning ? t("services.console") : t("services.start")}
        title={isRunning ? t("services.console") : t("services.start")}
        className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Icon icon={isRunning ? SquareTerminal : Play} size={14} />
      </button>
    </div>
  );
}
