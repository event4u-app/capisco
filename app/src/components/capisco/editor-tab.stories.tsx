import { FileCode, FileText } from "lucide-react";
import { EditorTab } from "./editor-tab";

const ts = <FileCode className="size-3.5 text-muted-foreground" strokeWidth={1.6} />;
const md = <FileText className="size-3.5 text-muted-foreground" strokeWidth={1.6} />;

export const Strip = () => (
  <div className="flex bg-card">
    <EditorTab name="worktree.ts" pinned icon={ts} />
    <EditorTab name="broker.ts" active icon={ts} onClose={() => {}} />
    <EditorTab name="session-tree.ts" icon={ts} onClose={() => {}} />
    <EditorTab name="README.md" dirty icon={md} />
  </div>
);
