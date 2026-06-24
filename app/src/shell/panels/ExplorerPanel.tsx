import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Folder,
  GitBranch,
  History,
  Library,
  ListCollapse,
  Plus,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { VirtualList } from "@/components/ui/virtual-list";
import { GitMarker } from "@/components/capisco/git-marker";
import { FileIcon } from "@/shell/editor/FileIcon";
import { mockProjects, mockScratches } from "@/mocks";
import { useOpenProject } from "@/shell/open-project-store";
import { useEditor } from "@/shell/editor/store";
import { PanelHead, PanelHeadAction } from "./PanelHead";
import { RealProjectTree } from "./RealProjectTree";
import { OpenProjectBar } from "./OpenProjectBar";
import { WorktreePanel } from "./WorktreePanel";

const ROW_HEIGHT = 26;

/** A row in the flattened, virtualized explorer model. */
type ExplorerRow =
  | {
      type: "project";
      id: string;
      name: string;
      path: string;
      branch: string;
      tracking?: string;
      expanded: boolean;
      selected: boolean;
    }
  | {
      type: "file";
      id: string;
      depth: number;
      name: string;
      ext: string;
      expandable?: boolean;
      expanded?: boolean;
      active?: boolean;
      git?: "M" | "A" | "D" | "U";
    }
  | {
      type: "branch";
      id: string;
      depth: number;
      labelKey: string;
      icon: "library" | "scratch";
      expandable: boolean;
      expanded?: boolean;
    }
  | { type: "scratch"; id: string; depth: number; name: string; ext: string };

/**
 * Explorer panel (build-spec §3) — several repos loaded side-by-side so the
 * agent has them all as context, plus the global "Scratches and Consoles" tree
 * and an External Libraries node. Project roots render as dark, raised, STICKY
 * separator bars (name + path + branch/tracking). The selected file gets a
 * lighter background + teal left strip + `M`/`A` git marker. The whole tree is
 * virtualized (fixed-row windowing) for heavy multi-repo workspaces.
 */
/** The id of the file flagged `active` in the mock (matches the flat row id). */
function initialActiveId(): string {
  for (const p of mockProjects) {
    const idx = p.files.findIndex((f) => f.active);
    if (idx >= 0) return `${p.id}/${p.files[idx].name}/${idx}`;
  }
  return "";
}

export function ExplorerPanel() {
  const { t } = useTranslation();
  // Active selected file id (project/path-scoped). Seeded from the mock's flag.
  const [active, setActive] = React.useState<string>(initialActiveId);
  // Collapsed set: project ids + synthetic branch ids ("external", "scratch").
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set(["tauri"]));
  const [scratchOpen, setScratchOpen] = React.useState(true);
  const [externalOpen, setExternalOpen] = React.useState(false);

  // P1 — the REAL opened project (null in the mock/visual harness). When a
  // project is open, the Explorer renders its live on-disk tree instead of the
  // mock-driven view; clicking a file loads real content into the editor.
  const project = useOpenProject((s) => s.project);
  const openProject = useOpenProject((s) => s.open);
  const closeProject = useOpenProject((s) => s.close);
  const readFile = useOpenProject((s) => s.readFile);
  const openRealDoc = useEditor((s) => s.openRealDoc);
  const [showOpenBar, setShowOpenBar] = React.useState(false);

  const onOpenFile = React.useCallback(
    async (relPath: string) => {
      const content = await readFile(relPath);
      openRealDoc({ file: content.relPath, ext: content.ext, text: content.text });
    },
    [readFile, openRealDoc],
  );

  const toggle = React.useCallback((id: string) => {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const collapseAll = React.useCallback(() => {
    setCollapsed(new Set(mockProjects.map((p) => p.id)));
    setScratchOpen(false);
    setExternalOpen(false);
  }, []);

  // Flatten projects + global trees into the windowed model. Project roots stay
  // in the flat list (they render as sticky bars via position:sticky on the row).
  const rows = React.useMemo<ExplorerRow[]>(() => {
    const out: ExplorerRow[] = [];
    for (const p of mockProjects) {
      const open = !collapsed.has(p.id);
      out.push({
        type: "project",
        id: p.id,
        name: p.name,
        path: p.path,
        branch: p.branch,
        tracking: p.tracking,
        expanded: open,
        selected: !!p.selected,
      });
      if (!open) continue;
      p.files.forEach((f, i) => {
        const id = `${p.id}/${f.name}/${i}`;
        out.push({
          type: "file",
          id,
          depth: f.depth,
          name: f.name,
          ext: f.ext,
          expandable: f.expandable,
          expanded: f.expanded,
          active: f.active,
          git: f.git,
        });
      });
    }
    // Global External Libraries node.
    out.push({
      type: "branch",
      id: "external",
      depth: 0,
      labelKey: "explorer.externalLibraries",
      icon: "library",
      expandable: true,
      expanded: externalOpen,
    });
    // Global Scratches and Consoles tree.
    out.push({
      type: "branch",
      id: "scratch",
      depth: 0,
      labelKey: "explorer.scratches",
      icon: "scratch",
      expandable: true,
      expanded: scratchOpen,
    });
    if (scratchOpen) {
      mockScratches.forEach((s, i) =>
        out.push({
          type: "scratch",
          id: `scratch/${s.name}/${i}`,
          depth: 1,
          name: s.name,
          ext: s.ext,
        }),
      );
    }
    return out;
  }, [collapsed, scratchOpen, externalOpen]);

  const onActivate = React.useCallback(
    (row: ExplorerRow) => {
      switch (row.type) {
        case "project":
          toggle(row.id);
          break;
        case "branch":
          if (row.id === "scratch") setScratchOpen((v) => !v);
          else setExternalOpen((v) => !v);
          break;
        case "file":
        case "scratch":
          // Selecting a file/scratch highlights it (teal strip + lighter bg);
          // dir rows are static in the mock but still highlight on select.
          setActive(row.id);
          break;
      }
    },
    [toggle],
  );

  // Roving-tabindex keyboard navigation across the flat row model.
  const [focusIdx, setFocusIdx] = React.useState(0);
  const treeRef = React.useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const r = rows[focusIdx];
      if (r) onActivate(r);
    }
  };

  return (
    <div data-testid="explorer-panel" className="flex h-full min-h-0 flex-col">
      <PanelHead title={project ? project.name : t("explorer.head")}>
        <PanelHeadAction
          icon={Plus}
          label={t("explorer.openProject")}
          onClick={() => setShowOpenBar((v) => !v)}
        />
        <PanelHeadAction
          icon={ListCollapse}
          label={t("explorer.collapseAll")}
          onClick={collapseAll}
        />
        <PanelHeadAction icon={RefreshCw} label={t("explorer.refresh")} />
      </PanelHead>
      {(showOpenBar || project) && (
        <OpenProjectBar
          onOpen={(path) => {
            setShowOpenBar(false);
            void openProject(path);
          }}
          onClose={project ? closeProject : undefined}
        />
      )}
      {project ? (
        // P1 — the REAL opened-project tree (live on-disk + git markers); P3 —
        // the live worktree panel (create/switch + start a stub session).
        <>
          <WorktreePanel />
          <RealProjectTree onOpenFile={(rel) => void onOpenFile(rel)} />
        </>
      ) : (
        <div
          ref={treeRef}
          role="tree"
          aria-label={t("explorer.label")}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="min-h-0 flex-1 select-none text-ui outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <VirtualList
            testid="explorer-tree"
            items={rows}
            rowHeight={ROW_HEIGHT}
            className="h-full"
            renderRow={(row, i) => (
              <ExplorerRowView
                row={row}
                active={"id" in row && row.id === active}
                focused={i === focusIdx}
                onActivate={() => {
                  setFocusIdx(i);
                  onActivate(row);
                }}
              />
            )}
          />
        </div>
      )}
    </div>
  );
}

function ExplorerRowView({
  row,
  active,
  focused,
  onActivate,
}: {
  row: ExplorerRow;
  active: boolean;
  focused: boolean;
  onActivate: () => void;
}) {
  const { t } = useTranslation();

  if (row.type === "project") {
    return (
      <div
        role="treeitem"
        aria-level={1}
        aria-expanded={row.expanded}
        data-testid={`explorer-project-${row.id}`}
        onClick={onActivate}
        // Prototype `.proj-root`: sticky raised separator bar (name + path +
        // branch); selected → accent-tint + inset teal strip.
        className={cn(
          "proj-root",
          row.selected && "selected",
          focused && "ring-1 ring-inset ring-ring",
        )}
      >
        <span className="tw-chevron">
          <ChevronRight
            className={cn("size-3 transition-transform", row.expanded && "rotate-90")}
            strokeWidth={2}
            aria-hidden
          />
        </span>
        <Icon icon={Folder} size={15} className="shrink-0 text-muted-foreground" />
        <span className="proj-name">{row.name}</span>
        <span className="proj-path">— {row.path}</span>
        <span className="proj-branch">
          <Icon icon={GitBranch} size={11} />
          {row.branch}
          {row.tracking && <span className="proj-track">{row.tracking}</span>}
        </span>
      </div>
    );
  }

  if (row.type === "branch") {
    return (
      <BaseRow
        depth={row.depth}
        expandable
        expanded={row.expanded}
        focused={focused}
        active={active}
        onActivate={onActivate}
        testid={`explorer-branch-${row.id}`}
        icon={
          <Icon
            icon={row.icon === "library" ? Library : History}
            size={14}
            className={row.icon === "scratch" ? "text-primary" : "text-muted-foreground"}
          />
        }
        label={t(row.labelKey)}
      />
    );
  }

  if (row.type === "scratch") {
    return (
      <BaseRow
        depth={row.depth}
        focused={focused}
        active={active}
        onActivate={onActivate}
        testid={`explorer-scratch-${row.id}`}
        icon={<FileIcon ext={row.ext} />}
        label={row.name}
      />
    );
  }

  // file / dir row
  const isDir = row.ext === "dir";
  return (
    <BaseRow
      depth={row.depth}
      expandable={row.expandable}
      expanded={row.expanded}
      focused={focused}
      active={active}
      onActivate={onActivate}
      testid={`explorer-file-${row.name}`}
      icon={
        isDir ? (
          <Icon icon={Folder} size={13} className="text-muted-foreground" />
        ) : (
          <FileIcon ext={row.ext} />
        )
      }
      label={row.name}
      trailing={row.git ? <GitMarker status={row.git} /> : undefined}
    />
  );
}

/** A single indented file/branch row — selected = lighter bg + teal left strip. */
function BaseRow({
  depth,
  expandable,
  expanded,
  active,
  focused,
  onActivate,
  testid,
  icon,
  label,
  trailing,
}: {
  depth: number;
  expandable?: boolean;
  expanded?: boolean;
  active: boolean;
  focused: boolean;
  onActivate: () => void;
  testid: string;
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={active}
      aria-expanded={expandable ? !!expanded : undefined}
      data-testid={testid}
      onClick={onActivate}
      // Prototype TreeRow: padding-left 4 + depth*14; active = accent-tint +
      // inset teal strip (box-shadow, never covered).
      style={{ paddingLeft: 4 + depth * 14 }}
      className={cn("tr-row", active && "active", focused && "ring-1 ring-inset ring-ring")}
    >
      <span className="tr-chevron">
        {expandable && (
          <ChevronRight
            className={cn("size-3 transition-transform", expanded && "rotate-90")}
            strokeWidth={2}
            aria-hidden
          />
        )}
      </span>
      <span className="tr-icon">{icon}</span>
      <span className="tr-label">{label}</span>
      {trailing && <span className="tr-trailing">{trailing}</span>}
    </div>
  );
}
