import * as React from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { VirtualList } from "@/components/ui/virtual-list";
import { GitMarker } from "@/components/capisco/git-marker";
import { FileIcon } from "@/shell/editor/FileIcon";
import type { FsTreeNode } from "@/contracts";
import { useOpenProject } from "@/shell/open-project-store";

const ROW_HEIGHT = 26;

/**
 * Real-project file tree (road-to-runnable-dev P1). Renders the live on-disk
 * tree the sidecar walked (with git markers), collapsible by directory and
 * virtualized for large repos. Clicking a file loads its REAL content into the
 * editor via {@link onOpenFile}. Only mounted when a project is open, so the
 * mock-driven default Explorer (and its visual goldens) are untouched.
 */
export function RealProjectTree({ onOpenFile }: { onOpenFile: (relPath: string) => void }) {
  const { t } = useTranslation();
  const tree = useOpenProject((s) => s.tree);
  // Collapsed directory relPaths. Default: top-level expanded, deeper collapsed
  // is too aggressive — start fully expanded (the walk already prunes heavy dirs).
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const [activeFile, setActiveFile] = React.useState<string>("");

  // A directory is hidden when any ancestor on its relPath is collapsed.
  const visible = React.useMemo<FsTreeNode[]>(() => {
    if (collapsed.size === 0) return tree;
    return tree.filter((n) => {
      const parts = n.relPath.split("/");
      for (let i = 1; i < parts.length; i++) {
        const ancestor = parts.slice(0, i).join("/");
        if (collapsed.has(ancestor)) return false;
      }
      return true;
    });
  }, [tree, collapsed]);

  const toggle = React.useCallback((relPath: string) => {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(relPath)) next.delete(relPath);
      else next.add(relPath);
      return next;
    });
  }, []);

  if (tree.length === 0) {
    return (
      <div
        data-testid="real-project-tree"
        className="flex min-h-0 flex-1 items-center justify-center"
      >
        <span className="text-ui text-muted-foreground">{t("explorer.emptyTree")}</span>
      </div>
    );
  }

  return (
    <div
      role="tree"
      aria-label={t("explorer.label")}
      data-testid="real-project-tree"
      className="min-h-0 flex-1 select-none text-ui outline-none"
    >
      <VirtualList
        testid="real-project-tree-list"
        items={visible}
        rowHeight={ROW_HEIGHT}
        className="h-full"
        renderRow={(node) => (
          <RealTreeRow
            node={node}
            collapsed={collapsed.has(node.relPath)}
            active={node.relPath === activeFile}
            onActivate={() => {
              if (node.isDir) {
                toggle(node.relPath);
              } else {
                setActiveFile(node.relPath);
                onOpenFile(node.relPath);
              }
            }}
          />
        )}
      />
    </div>
  );
}

function RealTreeRow({
  node,
  collapsed,
  active,
  onActivate,
}: {
  node: FsTreeNode;
  collapsed: boolean;
  active: boolean;
  onActivate: () => void;
}) {
  return (
    <div
      role="treeitem"
      aria-level={node.depth + 1}
      aria-selected={active}
      aria-expanded={node.isDir ? !collapsed : undefined}
      data-testid={`real-file-${node.relPath}`}
      onClick={onActivate}
      style={{ paddingLeft: 4 + node.depth * 14 }}
      className={cn("tr-row", active && "active")}
    >
      <span className="tr-chevron">
        {node.isDir && (
          <ChevronRight
            className={cn("size-3 transition-transform", !collapsed && "rotate-90")}
            strokeWidth={2}
            aria-hidden
          />
        )}
      </span>
      <span className="tr-icon">
        {node.isDir ? (
          <Icon icon={Folder} size={13} className="text-muted-foreground" />
        ) : (
          <FileIcon ext={node.ext} />
        )}
      </span>
      <span className="tr-label">{node.name}</span>
      {node.git && (
        <span className="tr-trailing">
          <GitMarker status={node.git} />
        </span>
      )}
    </div>
  );
}
