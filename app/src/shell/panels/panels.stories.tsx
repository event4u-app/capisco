import * as React from "react";
import { ExplorerPanel } from "./ExplorerPanel";
import { ChangesPanel } from "./ChangesPanel";
import { CommitPanel } from "./CommitPanel";
import { SearchPanel } from "./SearchPanel";
import { StructurePanel } from "./StructurePanel";

/** R4 Git-Near provider views, each in a 260px-wide left-panel-sized frame. */
function PanelFrame({ children, height = 560 }: { children: React.ReactNode; height?: number }) {
  return (
    <div
      style={{ width: 300, height }}
      className="overflow-hidden rounded border border-border bg-card text-foreground"
    >
      {children}
    </div>
  );
}

export const Explorer = () => (
  <PanelFrame>
    <ExplorerPanel />
  </PanelFrame>
);

export const Changes = () => (
  <PanelFrame>
    <ChangesPanel />
  </PanelFrame>
);

export const Commit = () => (
  <PanelFrame>
    <CommitPanel />
  </PanelFrame>
);

export const SearchResults = () => (
  <PanelFrame>
    <SearchPanel />
  </PanelFrame>
);

export const Structure = () => (
  <PanelFrame>
    <StructurePanel />
  </PanelFrame>
);
