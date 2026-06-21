import { ToolAction } from "./tool-action";

export const WithDiff = () => (
  <div className="max-w-md">
    <ToolAction
      kind="Edit"
      target="src/core/worktree.ts"
      added={12}
      removed={4}
      defaultOpen
      onOpenInEditor={() => {}}
    >
      <div className="text-success">+ async teardown() {"{"}</div>
      <div className="text-success">+ await this.broker.release(this.port);</div>
      <div className="text-destructive">&minus; // TODO: free port</div>
    </ToolAction>
  </div>
);

export const SearchAction = () => (
  <div className="max-w-md">
    <ToolAction
      kind="Search"
      target={'"where is port allocated?" · 7 hits'}
      onOpenInEditor={() => {}}
    />
  </div>
);
