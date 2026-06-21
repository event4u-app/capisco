A tool invocation inside a session transcript — collapsible header with verb, target path (mono), and an optional diffstat.

```jsx
<ToolAction kind="Edit" target="src/core/worktree.ts" added={12} removed={4} />
<ToolAction kind="Read" target="package.json" expanded onToggle={...}>…file preview…</ToolAction>
```
