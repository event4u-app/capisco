import * as React from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Folder, Play, RefreshCw, SquareTerminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import type { ContainerStatus, RuntimeProvider, ServiceStat } from "@/contracts";
import { fakeRuntimeProvider } from "@/mocks";
import { PanelHead, PanelHeadAction } from "./PanelHead";

interface ServiceGroup {
  project: string;
  services: ServiceStat[];
}

function useRuntimeServices(runtime: RuntimeProvider): ServiceGroup[] {
  const [groups, setGroups] = React.useState<ServiceGroup[]>([]);
  React.useEffect(() => {
    let live = true;
    runtime.listServices().then((g) => {
      if (live) setGroups(g);
    });
    return () => {
      live = false;
    };
  }, [runtime]);
  return groups;
}

/** Status dot class per container status (prototype `.ct-running`/`.ct-exited`). */
function statusDotClass(status: ContainerStatus): string {
  switch (status) {
    case "running":
      return "ct-running";
    case "error":
      return "ct-error";
    case "exited":
      return "ct-exited";
  }
}

/**
 * Services panel — 1:1 port of the prototype container view (`.ct-*`):
 * ctop-style containers grouped by loaded project (sticky group header + `N/M up`
 * count), each row a status dot + name + image + CPU bar + meta + exec console.
 * Runtime-provider data/logic/testids preserved.
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

  const groups = useRuntimeServices(fakeRuntimeProvider);
  const empty = groups.length === 0;

  return (
    <div data-testid="services-panel" className="explorer">
      <PanelHead title={t("services.head")}>
        <PanelHeadAction icon={Play} label={t("services.startAll")} />
        <PanelHeadAction icon={RefreshCw} label={t("services.refresh")} />
      </PanelHead>
      {empty ? (
        <p data-testid="services-empty" className="px-3 py-2 text-micro text-muted-foreground">
          {t("services.empty")}
        </p>
      ) : (
        <div data-testid="services-list" className="tree">
          {groups.map((g) => {
            const running = g.services.filter((s) => s.status === "running").length;
            const open = !collapsed.has(g.project);
            return (
              <div key={g.project}>
                <button
                  type="button"
                  data-testid={`services-group-${g.project}`}
                  aria-expanded={open}
                  onClick={() => toggle(g.project)}
                  className="proj-root w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="tw-chevron">
                    <ChevronRight
                      className={cn("size-3 transition-transform", open && "rotate-90")}
                      strokeWidth={2}
                      aria-hidden
                    />
                  </span>
                  <Icon icon={Folder} size={15} className="shrink-0 text-muted-foreground" />
                  <span className="proj-name">{g.project}</span>
                  <span data-testid={`services-count-${g.project}`} className="proj-branch">
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
    <div data-testid={`services-row-${c.name}`} className="ct-row">
      <span
        data-testid={`services-dot-${c.name}`}
        className={cn("ct-dot", statusDotClass(c.status))}
        aria-hidden
      />
      <div className="ct-main">
        <div className="ct-top">
          <span className="ct-name">{c.name}</span>
          <span className="ct-image">{c.image}</span>
        </div>
        <div data-testid={`services-meta-${c.name}`} className="ct-meta">
          {isRunning ? (
            <>
              <b>{c.cpu}%</b> {t("services.cpu")} · {c.mem} · {c.ports}
            </>
          ) : (
            t(`services.status.${c.status}`)
          )}
        </div>
        {isRunning && (
          <div className="ct-bar">
            <div
              data-testid={`services-cpubar-${c.name}`}
              className="ct-fill"
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
        className="ct-console focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Icon icon={isRunning ? SquareTerminal : Play} size={14} />
      </button>
    </div>
  );
}
