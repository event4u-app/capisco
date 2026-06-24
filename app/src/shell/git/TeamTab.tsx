import * as React from "react";
import { useTranslation } from "react-i18next";
import { GitPullRequest, GitBranch, TriangleAlert, Eye, GitBranchPlus } from "lucide-react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { gitSnapshot } from "@/mocks/git";
import type { AwarenessEntry } from "@/contracts";

/**
 * One awareness row — 1:1 port of the prototype `AwarenessRow` (views.jsx):
 * `.aw-row` with an `.aw-av` presence ring (`.on` = active), `.aw-main`
 * (`.aw-top`/`.aw-act`/`.aw-when`, `.aw-where`, `.aw-files`/`.aw-file`(`.clash`),
 * `.aw-warn` overlap), and `.aw-actions` (view-diff + `.aw-cp` cherry-pick).
 */
function AwarenessRow({ a, by }: { a: AwarenessEntry; by: "pr" | "branch" }) {
  const { t } = useTranslation();
  return (
    <div data-testid={`team-row-${a.who}`} className="aw-row">
      <span className={cn("aw-av", a.status === "active" && "on")}>{a.who.slice(0, 2)}</span>
      <div className="aw-main">
        <div className="aw-top">
          <b>{a.who}</b> <span className="aw-act">{a.act}</span>{" "}
          <span className="aw-when">· {a.when}</span>
        </div>
        <div className="aw-where">
          <Icon icon={by === "pr" ? GitPullRequest : GitBranch} size={11} />
          {by === "pr" ? `${a.pr} · ${a.branch}` : a.branch}
        </div>
        <div className="aw-files">
          {a.files.map((f) => (
            <span key={f} className={cn("aw-file", a.overlap === f && "clash")}>
              {f}
            </span>
          ))}
        </div>
        {a.overlap && (
          <div data-testid={`team-overlap-${a.who}`} className="aw-warn">
            <Icon icon={TriangleAlert} size={11} />
            {t("git.team.overlap", { file: a.overlap })}
          </div>
        )}
      </div>
      <div className="aw-actions">
        <button
          type="button"
          aria-label={t("git.team.viewDiff")}
          title={t("git.team.viewDiff")}
          className="aw-btn focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Icon icon={Eye} size={13} />
        </button>
        <button
          type="button"
          data-testid={`team-cherry-${a.who}`}
          className="aw-btn aw-cp focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Icon icon={GitBranchPlus} size={13} />
          {t("git.team.cherryPick")}
        </button>
      </div>
    </div>
  );
}

/**
 * Team awareness tab — 1:1 port of the prototype `TeamTab` (views.jsx): a
 * `.team-bar` (hint + `.as-seg team-seg` By PR / By branch toggle) over an
 * `.aw-list` of awareness rows with overlap warnings and a cherry-pick
 * affordance. Classes verbatim; app data + testids preserved.
 */
export function TeamTab() {
  const { t } = useTranslation();
  const [by, setBy] = React.useState<"pr" | "branch">("pr");
  const awareness = gitSnapshot.getAwareness();

  return (
    <div data-testid="git-team">
      <div className="team-bar">
        <span className="team-hint">{t("git.team.hint")}</span>
        <div className="as-seg team-seg" role="group">
          {(["pr", "branch"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              data-testid={`team-by-${opt}`}
              aria-pressed={by === opt}
              onClick={() => setBy(opt)}
              className={cn("as-opt", by === opt && "active")}
            >
              {opt === "pr" ? t("git.team.byPr") : t("git.team.byBranch")}
            </button>
          ))}
        </div>
      </div>
      {awareness.length ? (
        <div className="aw-list">
          {awareness.map((a) => (
            <AwarenessRow key={a.who} a={a} by={by} />
          ))}
        </div>
      ) : (
        <div data-testid="git-team-empty" className="ghpr-empty">
          {t("git.empty.team")}
        </div>
      )}
    </div>
  );
}
