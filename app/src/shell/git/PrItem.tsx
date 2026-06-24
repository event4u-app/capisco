import { useTranslation } from "react-i18next";
import {
  GitPullRequest,
  GitBranch,
  CircleCheck,
  CircleX,
  CircleDot,
  MessageSquare,
} from "lucide-react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { gitSnapshot } from "@/mocks/git";
import type { PrChecks, PullRequest, ReviewState } from "@/contracts";

const CHECK_ICON: Record<PrChecks, typeof CircleCheck> = {
  passing: CircleCheck,
  failing: CircleX,
  pending: CircleDot,
};
const CHECK_CLASS: Record<PrChecks, string> = {
  passing: "text-success",
  failing: "text-destructive",
  pending: "text-warning",
};
const REVIEW_CLASS: Record<ReviewState, string> = {
  approved: "border-success",
  changes: "border-destructive",
  pending: "border-muted-foreground",
};

function initials(who: string): string {
  return who === "you" ? "me" : who.slice(0, 2);
}

/**
 * One detailed GitHub-style PR row — 1:1 port of the prototype `PRItem`
 * (views.jsx): `.ghpr` row with a state glyph (`.ghpr-state`), title + number +
 * tags (`.ghpr-titleline` / draft / re-review / overdue), repo + branch + age
 * (`.ghpr-meta`), label chips (`.ghpr-labels`), and a side rail (`.ghpr-side`)
 * with checks, reviewer rings (`.ghpr-revs`/`.ghpr-av`) and comment / diff stats
 * (`.ghpr-stats`). `reReview` teal-highlights a "you reviewed before" PR;
 * `overdueTab` forces the "Nd ready" badge. Classes verbatim; data + testids
 * preserved.
 */
export function PrItem({
  pr,
  reReview,
  overdueTab,
  overdueThreshold,
}: {
  pr: PullRequest;
  reReview?: boolean;
  overdueTab?: boolean;
  overdueThreshold: number;
}) {
  const { t } = useTranslation();
  const CheckIcon = CHECK_ICON[pr.checks];
  const isOverdue = !pr.draft && pr.days > overdueThreshold;

  return (
    <div
      data-testid={`git-pr-${pr.num}`}
      data-re-review={reReview || undefined}
      className={cn("ghpr", reReview && "ghpr-hl")}
    >
      <span
        className={cn("ghpr-state", pr.draft && "text-muted-foreground")}
        title={pr.draft ? t("git.pr.draft") : t("git.pr.open")}
      >
        <Icon icon={GitPullRequest} size={16} />
      </span>
      <div className="ghpr-main">
        <div className="ghpr-titleline">
          <span className="ghpr-title">{pr.title}</span>
          <span className="ghpr-num">#{pr.num}</span>
          {pr.draft && <span className="ghpr-tag ghpr-draft">{t("git.pr.draft")}</span>}
          {reReview && (
            <span data-testid={`git-pr-${pr.num}-rereview`} className="ghpr-tag ghpr-re">
              {t("git.pr.reReview")}
            </span>
          )}
          {(overdueTab || isOverdue) && !pr.draft && (
            <span data-testid={`git-pr-${pr.num}-overdue`} className="ghpr-tag ghpr-od">
              {t("git.pr.ready", { days: pr.days })}
            </span>
          )}
        </div>
        <div className="ghpr-meta">
          <span className="ghpr-branch">
            <Icon icon={GitBranch} size={11} />
            {pr.branch}
          </span>
          <span>
            {t("git.pr.openedAgo", { repo: pr.repo, days: pr.days, author: pr.author })}
          </span>
        </div>
        {pr.labels.length > 0 && (
          <div className="ghpr-labels">
            {pr.labels.map((l) => (
              <span
                key={l}
                className="ghpr-label"
                style={{
                  color: `hsl(var(${gitSnapshot.labelChartVar(l)}))`,
                  borderColor: `hsl(var(${gitSnapshot.labelChartVar(l)}))`,
                }}
              >
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="ghpr-side">
        <span className={CHECK_CLASS[pr.checks]} title={t(`git.pr.checks.${pr.checks}`)}>
          <Icon icon={CheckIcon} size={13} />
        </span>
        {pr.reviews.length > 0 && (
          <div className="ghpr-revs">
            {pr.reviews.map((r, i) => (
              <span
                key={i}
                title={`${r.who} · ${t(`git.pr.review.${r.state}`)}`}
                className={cn("ghpr-av", REVIEW_CLASS[r.state])}
              >
                {initials(r.who)}
              </span>
            ))}
          </div>
        )}
        <div className="ghpr-stats">
          <span>
            <Icon icon={MessageSquare} size={12} />
            {pr.comments}
          </span>
          <span className="gd-add">+{pr.add}</span>
          <span className="gd-del">−{pr.del}</span>
        </div>
      </div>
    </div>
  );
}

export function PrList({
  list,
  highlightReReview,
  overdue,
  overdueThreshold,
  emptyKey,
  testid,
}: {
  list: PullRequest[];
  highlightReReview?: boolean;
  overdue?: boolean;
  overdueThreshold: number;
  emptyKey: string;
  testid: string;
}) {
  const { t } = useTranslation();
  if (!list.length) {
    return (
      <div data-testid={`${testid}-empty`} className="ghpr-empty">
        {t(emptyKey)}
      </div>
    );
  }
  return (
    <div data-testid={testid} className="ghpr-list">
      {list.map((p) => (
        <PrItem
          key={p.num}
          pr={p}
          reReview={highlightReReview && p.reviewedByMe}
          overdueTab={overdue}
          overdueThreshold={overdueThreshold}
        />
      ))}
    </div>
  );
}
