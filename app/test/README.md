# Test & Verify Harness

Three-layer evidence per `agents/roadmaps/00-capisco-overview.md` §4.

- **Unit/component** (`vitest`, `*.test.ts(x)`) — logic, hooks, contracts, mocks.
- **Stories** (`ladle`, `*.stories.tsx`) — every primitive renders in isolation, dark + light.
- **Visual + DOM + a11y** (`playwright`, `test/visual/*.spec.ts`):
  - **DOM/`data-testid` assertions = primary gate** (robust, the autonomy enabler).
  - **Pixel golden = tripwire** (`toHaveScreenshot`, `maxDiffPixelRatio: 0.01`).
  - **axe-core** — no serious/critical violations.

## `data-testid` convention

Every screen region and interactive control that a later roadmap must assert on
carries a stable `data-testid`. Naming: `kebab-case`, scoped by area
(`titlebar-project`, `activity-left`, `session-tab-<id>`, `broker-prompt`,
`composer-bar`, `status-bar`). Volatile content (token counts, runtimes) is
masked in golden captures, never asserted by value.

## Determinism (why goldens are stable)

Fonts self-hosted (no CDN), animations disabled, `prefers-reduced-motion`,
fixed 1440×880 viewport, deviceScaleFactor 1, deterministic mock seed.

## Commands

- `pnpm test` — unit/component (vitest).
- `pnpm verify:visual` — Playwright (builds, serves preview, captures, diffs, axe).
- `pnpm verify:visual:update` — refresh goldens after an intentional UI change.
- `pnpm ladle` — story explorer.
