import * as React from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/icon";
import { useOpenProject } from "@/shell/open-project-store";

/**
 * Open-project bar (road-to-runnable-dev P1). A path input that opens a REAL
 * project (the sidecar walks the repo → live file tree). Surfaces the opened
 * project header + a close affordance, and any open error inline. Dev-runtime
 * only in practice (the mock/visual harness never opens a project), so the
 * default Explorer view stays untouched.
 */
export function OpenProjectBar({
  onOpen,
  onClose,
}: {
  onOpen: (path: string) => void;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const project = useOpenProject((s) => s.project);
  const loading = useOpenProject((s) => s.loading);
  const error = useOpenProject((s) => s.error);
  const [path, setPath] = React.useState("");

  const submit = (): void => {
    const p = path.trim();
    if (p) onOpen(p);
  };

  return (
    <div
      data-testid="open-project-bar"
      className="flex flex-col gap-1 border-b border-border bg-secondary/40 px-2 py-1.5"
    >
      {project ? (
        <div className="flex items-center gap-1.5 text-ui" data-testid="open-project-current">
          <Icon icon={FolderOpen} size={13} className="text-primary" />
          <span className="truncate font-medium text-foreground">{project.name}</span>
          <span className="truncate text-micro text-muted-foreground">— {project.path}</span>
          <span className="ml-auto font-mono text-micro text-muted-foreground">
            {project.branch}
          </span>
          {onClose && (
            <button
              type="button"
              data-testid="open-project-close"
              title={t("explorer.closeProject")}
              aria-label={t("explorer.closeProject")}
              onClick={onClose}
              className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Icon icon={X} size={13} />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Input
            data-testid="open-project-input"
            value={path}
            disabled={loading}
            placeholder={t("explorer.pathPlaceholder")}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            className="h-6 font-mono text-micro"
          />
          <button
            type="button"
            data-testid="open-project-submit"
            disabled={loading || path.trim() === ""}
            onClick={submit}
            className="shrink-0 rounded-sm border border-input bg-muted px-2 py-0.5 text-micro text-foreground hover:bg-accent disabled:opacity-50"
          >
            {loading ? t("explorer.opening") : t("explorer.open")}
          </button>
        </div>
      )}
      {error && (
        <p data-testid="open-project-error" className="text-micro text-[hsl(var(--chart-bad))]">
          {t("explorer.openError", { message: error })}
        </p>
      )}
    </div>
  );
}
