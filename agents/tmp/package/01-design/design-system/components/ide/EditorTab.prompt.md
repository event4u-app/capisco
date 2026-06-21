One tab in the editor tab strip. The active tab takes the editor background so it visually merges with the editor, plus a 1px teal strip on top.

```jsx
<EditorTab icon={<FileIcon ext="ts" />} label="worktree.ts" pinned />
<EditorTab icon={<FileIcon ext="ts" />} label="broker.ts" active />
```

- `pinned` shows a pin glyph instead of the hover close (x).
- `dirty` shows an unsaved dot when not hovered.
