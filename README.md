# Capisco

An agent-native IDE. The window is built around AI coding agents as first-class
citizens — sessions, subagents, a capability broker, and a worktree-per-run
runtime — rather than bolting a chat box onto a classic editor.

The product is a Vite + React UI shell (`app/src/`) talking over JSON-RPC to a
headless TypeScript sidecar (`app/sidecar/`). The shell runs fully against
deterministic in-process mocks with no agent or bridge attached; a real sidecar,
real git, real worktrees, and a real agent backend are thin swaps behind the
same `contracts/`.

## Where to look

- **`app/DECISIONS.md`** — the decision log. Every foundation gate (shell
  carrier, Tailwind version, theme, i18n, icon set, editor lib, security
  invariants, backend contracts, sidecar IPC, broker) is recorded there with
  its rationale. **Read it before changing structure.**
- **`agents/roadmaps/`** — the work plans. `00-backend-overview.md` carries the
  follow-up sequencing and the load-bearing council corrections.
- **`app/src/`** — the React shell (chrome, panels, workspaces, stores).
- **`app/sidecar/`** — the Node-only sidecar (git, worktree, broker, ACP).

## Running it

```bash
cd app
pnpm install
pnpm dev        # UI wired to the real sidecar over a 127.0.0.1 WS bridge
```

## Quality gates

```bash
cd app
pnpm exec tsc -b
pnpm lint
pnpm exec vitest run
pnpm build
pnpm exec ladle build
pnpm exec playwright test   # DOM + axe everywhere; pixel goldens are a local (darwin) gate
```

Security invariants are enforced as tests: the broker is the single chokepoint
for any consequential side effect, secrets are credential-reference-only,
production datasources are read-only by construction, and the audit log is
append-only. See `app/DECISIONS.md` for the full list.
