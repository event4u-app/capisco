Square, monochrome icon control — toolbars, the two activity bars, panel headers, and hover-row actions. Set `active` for the selected item in an activity bar.

```jsx
<IconButton icon={<i data-lucide="files" />} active edge="left" title="Explorer" />
<IconButton icon={<i data-lucide="git-branch" />} title="Commit" />
```

- Default size 28px; activity-bar icons sit in a 48px column.
- `active` adds an accent tint and a 2px teal strip on `edge` (`left` for the left bar, `right` for the right bar).
- Icons are Lucide (linear, monochrome). Color is `--text-secondary`, going `--accent` when active.
