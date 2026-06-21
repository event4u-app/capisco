A row in the file-explorer tree. Reserves a chevron column so labels align whether or not a row is expandable. Active row gets a left teal strip.

```jsx
<TreeRow depth={0} expandable expanded icon={<FolderIcon open />} label="src" />
<TreeRow depth={2} icon={<FileIcon ext="ts" />} label="broker.ts" active trailing={<GitMarker status="M" />} />
```
