Flat, dense IDE button — use for chrome actions and the capability-broker permission prompts; teal `primary` only for the single most important action.

```jsx
<Button variant="primary" size="sm">Allow once</Button>
<Button variant="default">This session</Button>
<Button variant="ghost">Deny</Button>
```

- `variant`: `default` (subtle bordered, the workhorse), `primary` (teal fill — use sparingly), `ghost` (no chrome, secondary/cancel).
- `size`: `sm` (24px, default — matches IDE density) or `md` (28px).
- Hover lightens the surface; press nudges 0.5px down. Disabled drops to 45% opacity.
