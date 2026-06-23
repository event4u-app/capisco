import * as React from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Ellipsis, Inbox, RefreshCw } from "lucide-react";
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
 * Commit / Work-Stash panel — 1:1 port of the prototype `WorkStash`
 * (panels.jsx): Local Changes grouped by project + a git Shelf, switchable via
 * `.ws-tabs`. Classes (`.workstash`, `.ws-*`, `.tr-row`, `.shelf-*`) verbatim;
 * styling in capisco-composer.css. Data/logic/testids preserved.
 */
export function CommitPanel() {
  const { t } = useTranslation();
  const setMode = useLayout((s) => s.setMode);
  const [tab, setTab] = React.useState<Tab>("changes");
  const stash = mockWorkStash;
  const totalChanges = stash.groups.reduce((n, g) => n + g.files.length, 0);

  return (
    <div data-testid="commit-panel" className="workstash">
      <div className="ws-tabs">
        {/* tablist wraps ONLY the tabs (contents = no layout box) so the
            refresh/more actions are not non-tab children (aria-required-children). */}
        <div role="tablist" aria-label={t("commit.tabsLabel")} className="contents">
          <StashTab id="changes" active={tab} onSelect={setTab} label={t("commit.tabs.changes")} />
          <StashTab id="shelf" active={tab} onSelect={setTab} label={t("commit.tabs.shelf")} />
        </div>
        <div className="tb-spacer" />
        <PanelHeadAction icon={RefreshCw} label={t("commit.refresh")} />
        <PanelHeadAction icon={Ellipsis} label={t("commit.more")} />
      </div>

      {tab === "changes" ? (
        <>
          <div role="tabpanel" data-testid="commit-changes" className="ws-scroll">
            <div className="ws-subhead">
              <Icon icon={ChevronDown} size={12} />
              {t("commit.changesHead")}
              <span className="ws-count">{totalChanges}</span>
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
        <div role="tabpanel" data-testid="commit-shelf" className="ws-scroll">
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
      className={"ws-tab" + (selected ? " active" : "") + " focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"}
    >
      {label}
    </button>
  );
}

function ChangeGroupView({ group, onOpenDiff }: { group: ChangeGroup; onOpenDiff: () => void }) {
  return (
    <div>
      <div className="ws-group-head">
        <Icon icon={ChevronDown} size={11} className="text-muted-foreground" />
        <span className="ws-group-name">{group.project}</span>
        <span className="ws-group-branch">{group.branch}</span>
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
      style={{ paddingLeft: 4 + 1 * 14 }}
      className="tr-row w-full text-left"
    >
      <span className="tr-chevron" />
      <span className="tr-icon">
        <FileIcon ext={file.ext} />
      </span>
      <span className="tr-label">{file.name}</span>
      <span className="tr-trailing ws-row-meta">
        <span className="ws-path">{file.path}</span>
        <GitMarker status={file.git} />
      </span>
    </button>
  );
}

function ShelfRow({ entry }: { entry: ShelfEntry }) {
  return (
    <div data-testid={`commit-shelf-${entry.name}`} className="shelf-row">
      <Icon icon={Inbox} size={14} className="shrink-0 text-muted-foreground" />
      <div className="shelf-text">
        <div className="shelf-name">{entry.name}</div>
        <div className="shelf-meta">{entry.meta}</div>
      </div>
    </div>
  );
}

function CommitBox({ branch }: { branch: string }) {
  const { t } = useTranslation();
  const [message, setMessage] = React.useState("");
  return (
    <div className="ws-commit">
      <textarea
        data-testid="commit-message"
        aria-label={t("commit.messageLabel")}
        title={t("commit.resize")}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("commit.messagePlaceholder")}
        rows={3}
        className="ws-commit-msg"
      />
      <div className="ws-commit-actions">
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
