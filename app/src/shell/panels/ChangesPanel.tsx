import * as React from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, ChevronDown, GitBranch, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { GitMarker } from "@/components/capisco/git-marker";
import { FileIcon } from "@/shell/editor/FileIcon";
import type { ChangeFile, CompareBranch } from "@/contracts";
import { mockChangeSet, mockCurrentBranch } from "@/mocks";
import { useLayout } from "../store";
import { PanelHead, PanelHeadAction } from "./PanelHead";

/**
 * Changes panel (build-spec §3) — diff of the current branch vs a chosen BASE
 * branch. Base defaults to the PR target when an open PR exists, else the
 * branch's parent. Any other branch is pickable via a searchable combobox.
 * Header reads `base ▾ → current`; each file shows per-file `+adds/−dels` and
 * clicking a file opens the recycled R1 Diff view.
 */
export function ChangesPanel() {
  const { t } = useTranslation();
  const setMode = useLayout((s) => s.setMode);
  const cs = mockChangeSet;

  const defaultRole = cs.hasPullRequest ? "target" : "parent";
  const initialBase =
    (cs.branches.find((b) => b.role === defaultRole) ?? cs.branches[0])?.id ?? "";
  const [base, setBase] = React.useState(initialBase);

  const current = cs.branches.find((b) => b.id === base) ?? cs.branches[0];
  const total = cs.files.reduce(
    (a, f) => ({ added: a.added + f.added, removed: a.removed + f.removed }),
    {
      added: 0,
      removed: 0,
    },
  );

  return (
    <div data-testid="changes-panel" className="flex h-full min-h-0 flex-col">
      <PanelHead title={t("changes.head")}>
        <PanelHeadAction icon={RefreshCw} label={t("changes.refresh")} />
      </PanelHead>

      {/* base ▾ → current */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-2 py-1.5">
        <BaseBranchCombobox branches={cs.branches} value={base} onChange={setBase} />
        <Icon icon={ArrowRight} size={12} className="shrink-0 text-muted-foreground" />
        <span
          data-testid="changes-current"
          title={t("changes.currentTitle", { branch: mockCurrentBranch })}
          className="flex shrink-0 items-center gap-1 text-micro text-foreground"
        >
          <Icon icon={GitBranch} size={11} className="text-primary" />
          {t("changes.current")}
        </span>
      </div>

      <div
        data-testid="changes-summary"
        className="shrink-0 border-b border-border px-2 py-1 text-micro text-muted-foreground"
      >
        {t("changes.summary", { count: cs.files.length })} ·{" "}
        <span className="text-success">+{total.added}</span>{" "}
        <span className="text-destructive">−{total.removed}</span>
      </div>

      <div role="tree" aria-label={t("changes.tree")} className="tree">
        {cs.files.length === 0 ? (
          <p className="px-3 py-2 text-micro text-muted-foreground">
            {t("changes.empty", { base: current?.name })}
          </p>
        ) : (
          cs.files.map((f) => (
            <ChangeFileRow
              key={`${f.path}/${f.name}`}
              file={f}
              onOpen={() => setMode("diff")}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ChangeFileRow({ file, onOpen }: { file: ChangeFile; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      role="treeitem"
      data-testid={`changes-file-${file.name}`}
      onClick={onOpen}
      title={t("diff.open")}
      style={{ paddingLeft: 8 }}
      className="tr-row w-full text-left"
    >
      <span className="tr-icon">
        <FileIcon ext={file.ext} />
      </span>
      <span className="tr-label">{file.name}</span>
      <span className="tr-trailing font-mono text-micro" style={{ gap: 6 }}>
        <span style={{ color: "var(--ds-success)" }}>+{file.added}</span>
        <span style={{ color: "var(--ds-error)" }}>−{file.removed}</span>
        <GitMarker status={file.git} />
      </span>
    </button>
  );
}

/** Searchable base-branch combobox (build-spec §3). Filtered list, role tags,
 * keyboard-operable, closes on select / Escape / outside click. */
function BaseBranchCombobox({
  branches,
  value,
  onChange,
}: {
  branches: CompareBranch[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const current = branches.find((b) => b.id === value) ?? branches[0];
  const filtered = branches.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()));

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const openPop = () => {
    setQ("");
    setOpen((o) => !o);
  };

  const roleLabel = (role?: "target" | "parent") => (role ? t(`changes.role.${role}`) : null);

  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        data-testid="changes-base-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("changes.pickBase")}
        onClick={openPop}
        className="flex h-6 w-full items-center gap-1 rounded-sm border border-border bg-card px-1.5 text-micro text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Icon icon={GitBranch} size={11} className="shrink-0 text-muted-foreground" />
        <span className="truncate">{current?.name}</span>
        {current?.role && (
          <span className="shrink-0 rounded-sm bg-secondary px-1 text-[10px] text-muted-foreground">
            {roleLabel(current.role)}
          </span>
        )}
        <Icon icon={ChevronDown} size={11} className="ml-auto shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" aria-hidden onClick={() => setOpen(false)} />
          <div
            role="listbox"
            data-testid="changes-base-pop"
            className="absolute left-0 top-full z-30 mt-1 w-[240px] overflow-hidden rounded-md border border-border bg-popover shadow-md"
          >
            <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
              <Icon icon={Search} size={12} className="shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                data-testid="changes-base-search"
                value={q}
                placeholder={t("changes.findBranch")}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                }}
                className="min-w-0 flex-1 bg-transparent text-micro text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-[240px] overflow-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-2 py-1.5 text-micro text-muted-foreground">
                  {t("changes.noBranches")}
                </p>
              ) : (
                filtered.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    role="option"
                    aria-selected={b.id === value}
                    data-testid={`changes-base-option-${b.id}`}
                    onClick={() => {
                      onChange(b.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-1.5 px-2 py-1 text-left text-micro text-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                      b.id === value && "bg-accent/60",
                    )}
                  >
                    <Icon
                      icon={GitBranch}
                      size={11}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">{b.name}</span>
                    {b.role && (
                      <span className="shrink-0 rounded-sm bg-secondary px-1 text-[10px] text-muted-foreground">
                        {roleLabel(b.role)}
                      </span>
                    )}
                    {b.id === value && (
                      <Icon icon={Check} size={12} className="ml-auto shrink-0 text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
