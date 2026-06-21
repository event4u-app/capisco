import * as React from "react";
import { useTranslation } from "react-i18next";
import { GitPullRequest, GitBranch, TriangleAlert, Eye, GitBranchPlus } from "lucide-react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { mockGitProvider } from "@/mocks/git";
import type { AwarenessEntry } from "@/contracts";

function AwarenessRow({ a, by }: { a: AwarenessEntry; by: "pr" | "branch" }) {
  const { t } = useTranslation();
  return (
    <div data-testid={`team-row-${a.who}`} className="flex gap-3 border-b border-border px-4 py-3">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border text-micro",
          a.status === "active"
            ? "border-success text-foreground"
            : "border-border text-muted-foreground",
        )}
      >
        {a.who.slice(0, 2)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-ui">
          <b className="text-foreground">{a.who}</b>
          <span className="text-muted-foreground">{a.act}</span>
          <span className="text-muted-foreground">· {a.when}</span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-micro text-primary">
          <Icon icon={by === "pr" ? GitPullRequest : GitBranch} size={11} />
          {by === "pr" ? `${a.pr} · ${a.branch}` : a.branch}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {a.files.map((f) => (
            <span
              key={f}
              className={cn(
                "rounded-sm border border-border px-1 text-[9px] text-muted-foreground",
                a.overlap === f && "border-warning text-warning",
              )}
            >
              {f}
            </span>
          ))}
        </div>
        {a.overlap && (
          <div
            data-testid={`team-overlap-${a.who}`}
            className="mt-1 flex items-center gap-1 text-micro text-warning"
          >
            <Icon icon={TriangleAlert} size={11} />
            {t("git.team.overlap", { file: a.overlap })}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-start gap-1.5">
        <button
          type="button"
          aria-label={t("git.team.viewDiff")}
          title={t("git.team.viewDiff")}
          className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Icon icon={Eye} size={13} />
        </button>
        <button
          type="button"
          data-testid={`team-cherry-${a.who}`}
          className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-micro text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Icon icon={GitBranchPlus} size={13} />
          {t("git.team.cherryPick")}
        </button>
      </div>
    </div>
  );
}

/** Team awareness tab (git.live-style, build-spec §5 / prototype TeamTab):
 * who's working where, grouped By PR / By branch, with overlap warnings and a
 * cherry-pick affordance. */
export function TeamTab() {
  const { t } = useTranslation();
  const [by, setBy] = React.useState<"pr" | "branch">("pr");
  const awareness = mockGitProvider.getAwareness();

  return (
    <div data-testid="git-team">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <span className="text-micro text-muted-foreground">{t("git.team.hint")}</span>
        <div className="flex rounded-sm border border-border p-0.5 text-micro" role="group">
          {(["pr", "branch"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              data-testid={`team-by-${opt}`}
              aria-pressed={by === opt}
              onClick={() => setBy(opt)}
              className={cn(
                "rounded-[2px] px-2 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                by === opt ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt === "pr" ? t("git.team.byPr") : t("git.team.byBranch")}
            </button>
          ))}
        </div>
      </div>
      {awareness.length ? (
        awareness.map((a) => <AwarenessRow key={a.who} a={a} by={by} />)
      ) : (
        <div data-testid="git-team-empty" className="px-4 py-8 text-center text-ui text-muted-foreground">
          {t("git.empty.team")}
        </div>
      )}
    </div>
  );
}
