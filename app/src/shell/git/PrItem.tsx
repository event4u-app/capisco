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
import { mockGitProvider } from "@/mocks/git";
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
 * One detailed GitHub-style PR row (build-spec §5, prototype views.jsx PRItem):
 * state glyph, title + number + tags (draft / re-review / overdue), repo +
 * branch + age, label chips, and a side rail with checks, reviewer rings, and
 * comment / diff stats. `reReview` teal-highlights a "you reviewed before" PR;
 * `overdueTab` forces the "Nd ready" badge. All colours are tokens.
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
      className={cn(
        "flex gap-3 border-b border-border px-4 py-3",
        reReview && "bg-accent/40",
      )}
    >
      <span
        className={cn("mt-0.5 shrink-0", pr.draft ? "text-muted-foreground" : "text-primary")}
        title={pr.draft ? t("git.pr.draft") : t("git.pr.open")}
      >
        <Icon icon={GitPullRequest} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-ui font-medium text-foreground">{pr.title}</span>
          <span className="text-micro text-muted-foreground">#{pr.num}</span>
          {pr.draft && (
            <span className="rounded-sm border border-border px-1 text-[9px] uppercase text-muted-foreground">
              {t("git.pr.draft")}
            </span>
          )}
          {reReview && (
            <span
              data-testid={`git-pr-${pr.num}-rereview`}
              className="rounded-sm border border-primary px-1 text-[9px] uppercase text-primary"
            >
              {t("git.pr.reReview")}
            </span>
          )}
          {(overdueTab || isOverdue) && !pr.draft && (
            <span
              data-testid={`git-pr-${pr.num}-overdue`}
              className="rounded-sm border border-warning px-1 text-[9px] uppercase text-warning"
            >
              {t("git.pr.ready", { days: pr.days })}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-micro text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Icon icon={GitBranch} size={11} />
            {pr.branch}
          </span>
          <span>{t("git.pr.openedAgo", { repo: pr.repo, days: pr.days, author: pr.author })}</span>
        </div>
        {pr.labels.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {pr.labels.map((l) => (
              <span
                key={l}
                className="rounded-sm border px-1 text-[9px]"
                style={{
                  color: `hsl(var(${mockGitProvider.labelChartVar(l)}))`,
                  borderColor: `hsl(var(${mockGitProvider.labelChartVar(l)}))`,
                }}
              >
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className={CHECK_CLASS[pr.checks]} title={t(`git.pr.checks.${pr.checks}`)}>
          <Icon icon={CheckIcon} size={13} />
        </span>
        {pr.reviews.length > 0 && (
          <div className="flex -space-x-1">
            {pr.reviews.map((r, i) => (
              <span
                key={i}
                title={`${r.who} · ${t(`git.pr.review.${r.state}`)}`}
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border bg-card text-[9px] text-muted-foreground",
                  REVIEW_CLASS[r.state],
                )}
              >
                {initials(r.who)}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 text-micro text-muted-foreground tabular-nums">
          <span className="inline-flex items-center gap-0.5">
            <Icon icon={MessageSquare} size={12} />
            {pr.comments}
          </span>
          <span className="text-success">+{pr.add}</span>
          <span className="text-destructive">−{pr.del}</span>
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
      <div data-testid={`${testid}-empty`} className="px-4 py-8 text-center text-ui text-muted-foreground">
        {t(emptyKey)}
      </div>
    );
  }
  return (
    <div data-testid={testid} className="flex flex-col">
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
