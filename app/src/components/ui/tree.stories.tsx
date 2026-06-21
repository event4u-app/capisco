import { useState } from "react";
import { FileCode, FolderOpen } from "lucide-react";
import { Tree, type TreeRowData } from "./tree";

const ROWS: TreeRowData[] = [
  {
    id: "src",
    label: "src",
    depth: 0,
    expandable: true,
    expanded: true,
    icon: <FolderOpen className="size-4 text-muted-foreground" strokeWidth={1.6} />,
  },
  {
    id: "worktree",
    label: "worktree.ts",
    depth: 1,
    icon: <FileCode className="size-4 text-muted-foreground" strokeWidth={1.6} />,
    trailing: <span className="font-mono text-micro text-warning">M</span>,
  },
  {
    id: "broker",
    label: "broker.ts",
    depth: 1,
    icon: <FileCode className="size-4 text-muted-foreground" strokeWidth={1.6} />,
    trailing: <span className="font-mono text-micro text-success">A</span>,
  },
];

export const FileExplorer = () => {
  const [active, setActive] = useState("broker");
  return (
    <Tree rows={ROWS} activeId={active} onSelect={setActive} label="files" className="w-56" />
  );
};
