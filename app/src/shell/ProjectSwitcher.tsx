import * as React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Circle, FolderGit2 } from "lucide-react";
import type { RecentProject } from "@/contracts";
import { getProviders } from "@/lib/desktop-shell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Project switcher (B0 Phase 2). Surfaces the passive machine-wide
 * Recent-Projects registry: the current project plus other instances/projects
 * recorded by any Capisco window on the host. Selecting another project is a
 * *reference / jump* — it does not load two projects into one window (the
 * deliberate non-goal; cross-project session search is a broker-scoped B3
 * follow-up).
 *
 * Reads through the {@link getProviders} bundle, so it transparently consumes
 * the file-backed registry on desktop and the in-memory mock in the browser.
 */
export function ProjectSwitcher({ current }: { current: string }) {
  const { t } = useTranslation();
  const [projects, setProjects] = React.useState<RecentProject[]>([]);

  React.useEffect(() => {
    let alive = true;
    void getProviders()
      .recent.list()
      .then((list) => {
        if (alive) setProjects(list);
      });
    return () => {
      alive = false;
    };
  }, []);

  const others = projects.filter((p) => p.name !== current);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="project-switcher"
          title={t("titlebar.project")}
          aria-label={t("titlebar.project")}
          className="flex h-6 items-center gap-1 rounded-sm px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {current}
          <ChevronDown className="size-3" strokeWidth={1.6} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel>{t("projectSwitcher.recent")}</DropdownMenuLabel>
        {others.length === 0 ? (
          <DropdownMenuItem disabled>{t("projectSwitcher.empty")}</DropdownMenuItem>
        ) : (
          others.map((p) => (
            <DropdownMenuItem key={p.path} data-testid={`recent-project-${p.name}`}>
              <FolderGit2 className="size-3.5 text-muted-foreground" strokeWidth={1.6} />
              <span className="flex-1 truncate">{p.name}</span>
              {p.branch ? (
                <span className="font-mono text-[11px] text-muted-foreground">{p.branch}</span>
              ) : null}
              <Circle
                className={
                  p.active
                    ? "size-2 fill-[hsl(var(--chart-good))] text-[hsl(var(--chart-good))]"
                    : "size-2 fill-muted text-muted"
                }
                aria-label={p.active ? t("projectSwitcher.active") : t("projectSwitcher.inactive")}
              />
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-[11px] text-muted-foreground">
          {t("projectSwitcher.note")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
