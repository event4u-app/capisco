import * as React from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Ellipsis, Inbox, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { GitMarker } from "@/components/capisco/git-marker";
import { FileIcon } from "@/shell/editor/FileIcon";
import type { ChangeFile, ChangeGroup, ShelfEntry } from "@/contracts";
import { mockWorkStash } from "@/mocks";
import { useLayout } from "../store";
import { PanelHeadAction } from "./PanelHead";

type Tab = "changes" | "shelf";

/**
 * Commit / Work-Stash panel (build-spec §3) — Local Changes grouped by project
 * plus a git Shelf, switchable via tabs. The Local Changes tab carries a
 * multi-line, vertically resizable commit-message box and a primary
 * "Commit to <branch>" button (+ a secondary "Commit and Push…").
 */
export function CommitPanel() {
  const { t } = useTranslation();
  const setMode = useLayout((s) => s.setMode);
  const [tab, setTab] = React.useState<Tab>("changes");
  const stash = mockWorkStash;

  const totalChanges = stash.groups.reduce((n, g) => n + g.files.length, 0);

  return (
    <div data-testid="commit-panel" className="flex h-full min-h-0 flex-col">
      <div className="flex h-7 shrink-0 items-center gap-0.5 border-b border-border bg-card px-1">
        <div role="tablist" aria-label={t("commit.tabsLabel")} className="flex items-center gap-0.5">
          <StashTab id="changes" active={tab} onSelect={setTab} label={t("commit.tabs.changes")} />
          <StashTab id="shelf" active={tab} onSelect={setTab} label={t("commit.tabs.shelf")} />
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <PanelHeadAction icon={RefreshCw} label={t("commit.refresh")} />
          <PanelHeadAction icon={Ellipsis} label={t("commit.more")} />
        </div>
      </div>

      {tab === "changes" ? (
        <>
          <div
            role="tabpanel"
            data-testid="commit-changes"
            className="min-h-0 flex-1 overflow-auto py-1"
          >
            <div className="flex items-center gap-1 px-2 py-1 text-micro font-medium uppercase tracking-wide text-muted-foreground">
              <Icon icon={ChevronDown} size={12} />
              {t("commit.changesHead")}
              <span className="ml-1 rounded-full bg-secondary px-1.5 text-[10px] text-muted-foreground">
                {totalChanges}
              </span>
            </div>
            {totalChanges === 0 ? (
              <p className="px-3 py-2 text-micro text-muted-foreground">{t("commit.changesEmpty")}</p>
            ) : (
              stash.groups.map((g) => (
                <ChangeGroupView key={g.project} group={g} onOpenDiff={() => setMode("diff")} />
              ))
            )}
          </div>
          <CommitBox branch={stash.commitBranch} />
        </>
      ) : (
        <div role="tabpanel" data-testid="commit-shelf" className="min-h-0 flex-1 overflow-auto py-1">
          {stash.shelf.length === 0 ? (
            <p className="px-3 py-2 text-micro text-muted-foreground">{t("commit.shelfEmpty")}</p>
          ) : (
            stash.shelf.map((s) => <ShelfRow key={s.name} entry={s} />)
          )}
        </div>
      )}
    </div>
  );
}

function StashTab({
  id,
  active,
  onSelect,
  label,
}: {
  id: Tab;
  active: Tab;
  onSelect: (t: Tab) => void;
  label: string;
}) {
  const selected = id === active;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      data-testid={`commit-tab-${id}`}
      onClick={() => onSelect(id)}
      className={cn(
        "h-6 rounded-sm px-2 text-micro focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        selected ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function ChangeGroupView({ group, onOpenDiff }: { group: ChangeGroup; onOpenDiff: () => void }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-2 py-1 text-micro text-muted-foreground">
        <Icon icon={ChevronDown} size={11} />
        <span className="truncate text-foreground">{group.project}</span>
        <span className="truncate text-micro text-muted-foreground">{group.branch}</span>
      </div>
      {group.files.map((f) => (
        <CommitFileRow key={`${group.project}/${f.name}`} file={f} onOpen={onOpenDiff} />
      ))}
    </div>
  );
}

function CommitFileRow({ file, onOpen }: { file: ChangeFile; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid={`commit-file-${file.name}`}
      onClick={onOpen}
      title={t("diff.open")}
      style={{ paddingLeft: 18 }}
      className="flex h-[26px] w-full items-center gap-1.5 pr-2 text-left text-ui hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span className="flex shrink-0 items-center">
        <FileIcon ext={file.ext} />
      </span>
      <span className="truncate text-foreground">{file.name}</span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        <span className="truncate text-micro text-muted-foreground">{file.path}</span>
        <GitMarker status={file.git} />
      </span>
    </button>
  );
}

function ShelfRow({ entry }: { entry: ShelfEntry }) {
  return (
    <div data-testid={`commit-shelf-${entry.name}`} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent">
      <Icon icon={Inbox} size={14} className="shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="truncate text-ui text-foreground">{entry.name}</div>
        <div className="truncate text-micro text-muted-foreground">{entry.meta}</div>
      </div>
    </div>
  );
}

function CommitBox({ branch }: { branch: string }) {
  const { t } = useTranslation();
  const [message, setMessage] = React.useState("");
  return (
    <div className="shrink-0 border-t border-border p-2">
      <textarea
        data-testid="commit-message"
        aria-label={t("commit.messageLabel")}
        title={t("commit.resize")}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("commit.messagePlaceholder")}
        rows={3}
        className="min-h-[56px] w-full resize-y rounded-sm border border-border bg-input px-2 py-1.5 font-mono text-code text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
      />
      <div className="mt-2 flex items-center gap-2">
        <Button data-testid="commit-button" variant="default" size="md" className="flex-1 gap-1.5">
          <Icon icon={Check} size={13} />
          {t("commit.commitTo", { branch })}
        </Button>
        <Button data-testid="commit-push-button" variant="outline" size="md">
          {t("commit.commitAndPush")}
        </Button>
      </div>
    </div>
  );
}
