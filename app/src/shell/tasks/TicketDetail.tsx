import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Check, GitBranchPlus, GitBranch, GitPullRequest } from "lucide-react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { mockTasksProvider } from "@/mocks/tasks";
import type { Ticket } from "@/contracts";
import { StatusDot } from "./TicketCards";

interface Comment {
  who: string;
  when: string;
  text: string;
}

function avatar(who: string): string {
  return who === "you" ? "me" : who.slice(0, 2);
}

/**
 * Ticket detail (build-spec §6 / prototype TicketDetail) — rendered inside its
 * own closable workspace tab. Editable description (toggle Edit ↔ Save), an
 * activity thread with a ⌘↵ composer, and a sidebar with status / assignee /
 * type / points / epic / PR plus "Create branch" + "Start in a worktree".
 */
export function TicketDetail({ ticket: t }: { ticket: Ticket }) {
  const { t: tr } = useTranslation();
  const tasks = mockTasksProvider;
  const detail = tasks.getTicketDetail(t.id);

  const [editing, setEditing] = React.useState(false);
  const [desc, setDesc] = React.useState(detail.description);
  const [comments, setComments] = React.useState<Comment[]>(detail.comments);
  const [draft, setDraft] = React.useState("");

  const typeVar = tasks.typeChartVar(t.type);

  const addComment = () => {
    const text = draft.trim();
    if (!text) return;
    setComments((c) => [...c, { who: "you", when: "now", text }]);
    setDraft("");
  };

  return (
    <div
      data-testid={`ticket-detail-${t.id}`}
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background"
    >
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-6 py-5">
        <div className="text-micro text-muted-foreground">
          {tr("tasks.detail.breadcrumb")} <span className="px-1">›</span> {t.id}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{t.title}</h2>
            <div className="mt-1 text-micro text-muted-foreground">
              <span className="text-foreground">{t.id}</span> ·{" "}
              {tr("tasks.detail.openedBy", { who: t.who, sprint: tasks.getSprint().name })}
            </div>

            <section className="mt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-ui font-medium text-foreground">{tr("tasks.detail.description")}</h3>
                <button
                  type="button"
                  data-testid={`ticket-edit-${t.id}`}
                  onClick={() => setEditing((v) => !v)}
                  className="inline-flex items-center gap-1 text-micro text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <Icon icon={editing ? Check : Pencil} size={12} />
                  {editing ? tr("tasks.detail.save") : tr("tasks.detail.edit")}
                </button>
              </div>
              {editing ? (
                <textarea
                  data-testid={`ticket-desc-edit-${t.id}`}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="mt-2 h-40 w-full resize-y rounded-md border border-border bg-muted p-2 text-ui text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              ) : (
                <div data-testid={`ticket-desc-${t.id}`} className="mt-2 whitespace-pre-wrap text-ui text-muted-foreground">
                  {desc}
                </div>
              )}
            </section>

            <section className="mt-6">
              <h3 className="text-ui font-medium text-foreground">
                {tr("tasks.detail.activity", { count: comments.length })}
              </h3>
              <div data-testid={`ticket-comments-${t.id}`} className="mt-2 flex flex-col gap-3">
                {comments.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-micro">
                      {avatar(c.who)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-micro text-muted-foreground">
                        <b className="text-foreground">{c.who}</b> · {c.when}
                      </div>
                      <div className="text-ui text-foreground">{c.text}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <textarea
                  data-testid={`ticket-composer-${t.id}`}
                  placeholder={tr("tasks.detail.commentPlaceholder")}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      addComment();
                    }
                  }}
                  className="h-20 w-full resize-y rounded-md border border-border bg-muted p-2 text-ui text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-micro text-muted-foreground">{tr("tasks.detail.commentHint")}</span>
                  <Button
                    data-testid={`ticket-comment-send-${t.id}`}
                    variant="default"
                    size="sm"
                    onClick={addComment}
                  >
                    {tr("tasks.detail.commentSend")}
                  </Button>
                </div>
              </div>
            </section>
          </div>

          <aside data-testid={`ticket-sidebar-${t.id}`} className="flex flex-col gap-3">
            <Field label={tr("tasks.detail.fields.status")}>
              <span className="inline-flex items-center gap-1.5">
                <StatusDot status={t.status} />
                {tr(`tasks.status.${t.status}`)}
              </span>
            </Field>
            <Field label={tr("tasks.detail.fields.assignee")}>
              <span className="inline-flex items-center gap-1.5">
                <span className="flex size-4 items-center justify-center rounded-full bg-accent text-[9px]">
                  {avatar(t.who)}
                </span>
                {t.who}
              </span>
            </Field>
            <Field label={tr("tasks.detail.fields.type")}>
              <span
                className="rounded-sm border px-1 text-[9px]"
                style={{ color: `hsl(var(${typeVar}))`, borderColor: `hsl(var(${typeVar}))` }}
              >
                {t.type}
              </span>
            </Field>
            <Field label={tr("tasks.detail.fields.points")}>
              <span className="tabular-nums">{t.points}</span>
            </Field>
            <Field label={tr("tasks.detail.fields.epic")}>{tasks.epicLabel(t.epic)}</Field>
            {t.branch && (
              <Field label={tr("tasks.detail.fields.pullRequest")}>
                <span className="inline-flex items-center gap-1 text-primary">
                  <Icon icon={GitPullRequest} size={12} />
                  {t.branch}
                </span>
              </Field>
            )}
            {t.sub && <Field label={tr("tasks.detail.fields.subtasks")}>{t.sub}</Field>}

            <div className="mt-1 flex flex-col gap-2">
              <Button data-testid={`ticket-create-branch-${t.id}`} variant="default" className="w-full">
                <Icon icon={GitBranchPlus} size={13} />
                {tr("tasks.detail.createBranch")}
              </Button>
              <Button data-testid={`ticket-start-worktree-${t.id}`} variant="outline" className="w-full">
                <Icon icon={GitBranch} size={13} />
                {tr("tasks.detail.startWorktree")}
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-micro uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="text-ui text-foreground">{children}</div>
    </div>
  );
}
