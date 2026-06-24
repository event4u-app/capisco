import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Check, GitBranchPlus, GitBranch, GitPullRequest } from "lucide-react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { tasksSnapshot } from "@/mocks/tasks";
import type { Ticket } from "@/contracts";

interface Comment {
  who: string;
  when: string;
  text: string;
}

const TYPE_COLOR: Record<string, string> = {
  feature: "var(--ds-accent)",
  bug: "var(--ds-error)",
  chore: "var(--ds-text-tertiary)",
};

function avatar(who: string): string {
  return who === "you" ? "me" : who.slice(0, 2);
}

/**
 * Ticket detail — 1:1 port of the prototype `TicketDetail` (views.jsx): a
 * `.git-workspace` body with `.td-grid` (main `.td-main` + sidebar `.td-side`).
 * Editable description (`.td-desc`/`.td-descedit`, toggle Edit ↔ Save), an
 * activity thread (`.td-comments`/`.td-comment`) with a ⌘↵ composer
 * (`.td-compose`), and `.td-field` rows for status / assignee / type / points /
 * epic / PR plus "Create branch" + "Start in a worktree". Classes verbatim; app
 * logic, i18n + testids preserved.
 */
export function TicketDetail({ ticket: t }: { ticket: Ticket }) {
  const { t: tr } = useTranslation();
  const tasks = tasksSnapshot;
  const detail = tasks.getTicketDetail(t.id);

  const [editing, setEditing] = React.useState(false);
  const [desc, setDesc] = React.useState(detail.description);
  const [comments, setComments] = React.useState<Comment[]>(detail.comments);
  const [draft, setDraft] = React.useState("");

  const typeColor = TYPE_COLOR[t.type] ?? "var(--ds-text-tertiary)";

  const addComment = () => {
    const text = draft.trim();
    if (!text) return;
    setComments((c) => [...c, { who: "you", when: "now", text }]);
    setDraft("");
  };

  return (
    <div data-testid={`ticket-detail-${t.id}`} className="git-workspace min-w-0">
      <div className="gitw-inner td-inner">
        <div className="td-bc">
          {tr("tasks.detail.breadcrumb")} <span className="sep">›</span> {t.id}
        </div>
        <div className="td-grid">
          <div className="td-main">
            <h2 className="td-title">{t.title}</h2>
            <div className="td-sub">
              <span className="td-id">{t.id}</span> ·{" "}
              {tr("tasks.detail.openedBy", { who: t.who, sprint: tasks.getSprint().name })}
            </div>

            <div className="td-section">
              <div className="td-sechead">
                {tr("tasks.detail.description")}
                <button
                  type="button"
                  data-testid={`ticket-edit-${t.id}`}
                  onClick={() => setEditing((v) => !v)}
                  className="td-edit focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                  className="td-descedit focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              ) : (
                <div data-testid={`ticket-desc-${t.id}`} className="td-desc">
                  {desc.split("\n").map((l, i) => (
                    <p key={i}>{l || " "}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="td-section">
              <div className="td-sechead">
                {tr("tasks.detail.activity", { count: comments.length })}
              </div>
              <div data-testid={`ticket-comments-${t.id}`} className="td-comments">
                {comments.map((c, i) => (
                  <div key={i} className="td-comment">
                    <span className="td-cav">{avatar(c.who)}</span>
                    <div className="td-cbody">
                      <div className="td-cmeta">
                        <b>{c.who}</b> · {c.when}
                      </div>
                      <div className="td-ctext">{c.text}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="td-compose">
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
                  className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <div className="td-composeactions">
                  <span className="td-hint">{tr("tasks.detail.commentHint")}</span>
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
            </div>
          </div>

          <aside data-testid={`ticket-sidebar-${t.id}`} className="td-side">
            <div className="td-field">
              <label>{tr("tasks.detail.fields.status")}</label>
              <div className="td-val">
                <span className={`tk-actdot st-${t.status}`} />
                {tr(`tasks.status.${t.status}`)}
              </div>
            </div>
            <div className="td-field">
              <label>{tr("tasks.detail.fields.assignee")}</label>
              <div className="td-val">
                <span className="td-cav sm">{avatar(t.who)}</span>
                {t.who}
              </div>
            </div>
            <div className="td-field">
              <label>{tr("tasks.detail.fields.type")}</label>
              <div className="td-val">
                <span className="lc-label" style={{ color: typeColor, borderColor: typeColor }}>
                  {t.type}
                </span>
              </div>
            </div>
            <div className="td-field">
              <label>{tr("tasks.detail.fields.points")}</label>
              <div className="td-val tabular-nums">{t.points}</div>
            </div>
            <div className="td-field">
              <label>{tr("tasks.detail.fields.epic")}</label>
              <div className="td-val">{tasks.epicLabel(t.epic)}</div>
            </div>
            {t.branch && (
              <div className="td-field">
                <label>{tr("tasks.detail.fields.pullRequest")}</label>
                <div className="td-val td-link">
                  <Icon icon={GitPullRequest} size={12} />
                  {t.branch}
                </div>
              </div>
            )}
            {t.sub && (
              <div className="td-field">
                <label>{tr("tasks.detail.fields.subtasks")}</label>
                <div className="td-val">{t.sub}</div>
              </div>
            )}
            <div className="td-actions">
              <Button
                data-testid={`ticket-create-branch-${t.id}`}
                variant="default"
                className="w-full"
              >
                <Icon icon={GitBranchPlus} size={13} />
                {tr("tasks.detail.createBranch")}
              </Button>
              <Button
                data-testid={`ticket-start-worktree-${t.id}`}
                variant="outline"
                className="mt-1.5 w-full"
              >
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
