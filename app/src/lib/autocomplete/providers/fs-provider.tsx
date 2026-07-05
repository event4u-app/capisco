/**
 * `@file` / `@folder` autocomplete provider (road-to-composer-intelligence P2).
 * Surfaces the project file tree as `@`-mentionable items. Files trigger an
 * `onAttach` side-effect (broker chokepoint: `ingestPaths`) on accept; folders
 * insert a reference-only mention with no side-effect.
 *
 * The tree is fetched ONCE per provider instance (cached promise) so repeated
 * keystrokes do not thrash the sidecar. Filtering/ranking is the engine's job.
 */

import { File, Folder } from "lucide-react";
import type { FsTreeNode } from "@/contracts/fs-tree";
import { getProviders } from "@/lib/desktop-shell";
import { cn } from "@/lib/utils";
import type { AutocompleteItem, AutocompleteProvider } from "../types";

export interface FsItem extends AutocompleteItem {
  node: FsTreeNode;
  absPath: string;
}

export interface MakeFsProviderOptions {
  /** Absolute repo root passed to `getTree`. Empty string → provider returns []. */
  projectRoot: string;
  /** Called with the absolute path when a FILE is accepted — broker chokepoint. */
  onAttach: (absPath: string) => void;
}

export function makeFsProvider(opts: MakeFsProviderOptions): AutocompleteProvider<FsItem> {
  // Cached promise — resolved at most once per provider instance.
  let treePromise: Promise<FsTreeNode[]> | null = null;

  function getTree(): Promise<FsTreeNode[]> {
    if (!treePromise) {
      treePromise = getProviders().projectFs.getTree(opts.projectRoot);
    }
    return treePromise;
  }

  return {
    triggerChar: "@",

    async getItems(query) {
      void query; // filtering is the engine's job; we return all nodes
      if (!opts.projectRoot) return [];
      const nodes = await getTree();
      return nodes.map((node) => ({
        id: node.relPath,
        label: node.name,
        mruScore: 0,
        node,
        absPath: `${opts.projectRoot}/${node.relPath}`,
      }));
    },

    renderItem(item, { highlighted, onChoose }) {
      const Icon = item.node.isDir ? Folder : File;
      return (
        <button
          type="button"
          role="option"
          aria-selected={highlighted}
          data-testid={`fs-option-${item.label}`}
          // mousedown (not click) so the input does not blur first
          onMouseDown={(e) => {
            e.preventDefault();
            onChoose(item);
          }}
          className={cn(
            "flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-ui focus-visible:outline-none",
            highlighted ? "bg-accent text-foreground" : "text-foreground hover:bg-accent",
          )}
        >
          <Icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.6} />
          <span className="flex-1 truncate">{item.label}</span>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {item.node.relPath}
          </span>
        </button>
      );
    },

    onSelect(item, token, bufferText) {
      const insert = `@${item.label} `;
      const before = bufferText.slice(0, token.start);
      const after = bufferText.slice(token.end);
      return {
        text: before + insert + after,
        caret: token.start + insert.length,
        sideEffect: item.node.isDir ? undefined : () => opts.onAttach(item.absPath),
      };
    },
  };
}
