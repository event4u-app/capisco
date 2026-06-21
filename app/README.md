# Capisco — app

The Capisco IDE front end: a Vite + React UI shell plus a headless TypeScript
sidecar (`sidecar/`) it talks to over JSON-RPC. This is Capisco, not a Vite
starter — start from **`DECISIONS.md`**, which records every foundation gate
and its rationale, then the roadmaps under `../agents/roadmaps/`.

## Layout

- `src/` — the React shell.
  - `shell/` — chrome (title/status/activity bars), dockable panels, and the
    center workspaces (`agents`, `editor`, `git`, `tasks`, `chat`).
  - `contracts/` — the provider interfaces; the seam where mocks swap for the
    real sidecar.
  - `mocks/` — deterministic in-process providers (no `Date.now` / `Math.random`)
    so the shell, unit tests, and Playwright visual specs run with no bridge or
    agent attached.
  - `components/` — `ui/` (shadcn-derived primitives) and `capisco/` (app-specific).
  - `i18n/`, `styles/`, `lib/`.
- `sidecar/` — Node-only providers (real git, worktrees, capability broker, ACP)
  behind the same `contracts/`.

## Develop

```bash
pnpm install
pnpm dev        # UI + real sidecar over a 127.0.0.1 WebSocket bridge
```

The mock fallback stays intact: with no bridge the UI is fully functional on
deterministic data.

## Quality gates

```bash
pnpm exec tsc -b
pnpm lint                  # 0 errors (3 known react-refresh warnings)
pnpm exec vitest run
pnpm build
pnpm exec ladle build
pnpm exec playwright test  # DOM + axe; pixel goldens local-only (darwin)
```

Conventions: every user-visible string goes through `t()`; interactive nodes
carry a stable `data-testid`; colours come from design tokens, never raw hex.
