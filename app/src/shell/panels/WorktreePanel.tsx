import * as React from "react";
import { useTranslation } from "react-i18next";
import { GitBranch, Plus, Play, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { Input } from "@/components/ui/input";
import { useWorktrees } from "@/shell/worktree-store";

/**
 * Worktree panel (road-to-runnable-dev P3). Lists the live git worktrees of the
 * open repo, lets the user create a new worktree+branch, switch the active one,
 * and start a (stub) agent session in it — all against the live sidecar. Only
 * mounted when a project is open, so the mock/visual harness never renders it
 * and the goldens stay untouched.
 */
export function WorktreePanel() {
  const { t } = useTranslation();
  const worktrees = useWorktrees((s) => s.worktrees);
  const activePath = useWorktrees((s) => s.activePath);
  const busy = useWorktrees((s) => s.busy);
  const error = useWorktrees((s) => s.error);
  const startedSessionId = useWorktrees((s) => s.startedSessionId);
  const refresh = useWorktrees((s) => s.refresh);
  const createWorktree = useWorktrees((s) => s.createWorktree);
  const setActive = useWorktrees((s) => s.setActive);
  const startSession = useWorktrees((s) => s.startSession);
  const [branch, setBranch] = React.useState("");

  // Load the worktree list once when the panel mounts (a project is open).
  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCreate = (): void => {
    const b = branch.trim();
    if (!b) return;
    void createWorktree(b).then(() => setBranch(""));
  };

  return (
    <div
      data-testid="worktree-panel"
      className="flex shrink-0 flex-col gap-1 border-b border-border bg-secondary/30 px-2 py-1.5 text-ui"
    >
      <div className="flex items-center gap-1.5 text-micro uppercase tracking-wide text-muted-foreground">
        <Icon icon={GitBranch} size={11} />
        <span>{t("worktree.head")}</span>
      </div>

      <ul data-testid="worktree-list" className="flex flex-col">
        {worktrees.map((w) => (
          <li key={w.path}>
            <button
              type="button"
              data-testid={`worktree-item-${w.branch ?? w.head}`}
              aria-pressed={w.path === activePath}
              onClick={() => setActive(w.path)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left hover:bg-accent",
                w.path === activePath && "bg-accent",
              )}
            >
              <Icon icon={GitBranch} size={11} className="shrink-0 text-muted-foreground" />
              <span className="truncate font-mono text-micro text-foreground">
                {w.branch ?? "(detached)"}
              </span>
              {w.isMain && (
                <span className="text-micro text-muted-foreground">{t("worktree.main")}</span>
              )}
              {w.sessionId && <Icon icon={Play} size={10} className="ml-auto text-primary" />}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-1.5">
        <Input
          data-testid="worktree-branch-input"
          value={branch}
          disabled={busy}
          placeholder={t("worktree.branchPlaceholder")}
          onChange={(e) => setBranch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCreate();
            }
          }}
          className="h-6 font-mono text-micro"
        />
        <button
          type="button"
          data-testid="worktree-create"
          disabled={busy || branch.trim() === ""}
          onClick={onCreate}
          title={t("worktree.create")}
          aria-label={t("worktree.create")}
          className="flex shrink-0 items-center gap-1 rounded-sm border border-input bg-muted px-2 py-0.5 text-micro text-foreground hover:bg-accent disabled:opacity-50"
        >
          <Icon icon={Plus} size={11} />
          {t("worktree.create")}
        </button>
      </div>

      <button
        type="button"
        data-testid="worktree-start-session"
        disabled={busy}
        onClick={() => void startSession(t("worktree.sessionPrompt"))}
        className="flex items-center gap-1 self-start rounded-sm border border-input bg-muted px-2 py-0.5 text-micro text-foreground hover:bg-accent disabled:opacity-50"
      >
        <Icon icon={Play} size={11} />
        {t("worktree.startSession")}
      </button>

      {startedSessionId && (
        <span
          data-testid="worktree-session-started"
          className="flex items-center gap-1 text-micro text-muted-foreground"
        >
          <Icon icon={Check} size={11} className="text-primary" />
          {t("worktree.sessionStarted", { id: startedSessionId })}
        </span>
      )}
      {error && (
        <p data-testid="worktree-error" className="text-micro text-[hsl(var(--chart-bad))]">
          {error}
        </p>
      )}
    </div>
  );
}
