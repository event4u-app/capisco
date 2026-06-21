Sunken (`--surface-input`) field for search, the terminal command line, the agent composer, and settings. Border goes teal on focus.

```jsx
<Input leading={<i data-lucide="search" />} placeholder="Search files…" />
<Input mono placeholder="Message Capisco…" trailing={<IconButton icon={<i data-lucide="arrow-up" />} />} />
```

- `mono` switches to JetBrains Mono + code size — use for the terminal/command line.
- `leading` / `trailing` slots hold icons or a send button.
