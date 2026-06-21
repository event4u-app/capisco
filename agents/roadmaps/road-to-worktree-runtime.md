---
status: complete
block: Backend
depends_on: [road-to-real-git]
unlocks: [road-to-session-store-and-acp]
autonomy: "A (worktrees) / B (container deferred)"
---

# Road to Worktree-Runtime (B2)

**Goal:** Git-Worktrees als das „Ort"-Primitiv (§2.1) — anlegen/auflisten/zerstören, isoliert &
reviewbar. Container-Runtime (Docker/Podman/Traefik) **abgespalten & deferred** (Konzept Phase 7).

> Council: B2 war über-gebündelt. Worktrees = trivialer B1-Sibling (autonom). Container = Phase-7-
> Schwergewicht, hinter `RuntimeProvider`-Interface + `FakeRuntimeProvider`, echter Docker-Swap später.

## Akzeptanz
- `WorktreeProvider`: create/list/destroy gegen echtes Git, hermetisch getestet (Temp-Repo, N Worktrees).
- `RuntimeProvider` existiert als Interface mit `FakeRuntimeProvider` (deterministische `docker stats`-Frames); Services-View läuft dagegen. Echter Docker = dokumentierter Swap (deferred).

## Phase 0 — Worktrees (real)
- [x] `git worktree add/list/remove`; Worktree↔Session-Kopplung (§2.1); GC bei Crash.

## Phase 1 — Runtime-Provider (Interface + Fake)
- [x] `RuntimeProvider`-Interface; `FakeRuntimeProvider` speist Services-View; Port-Allocator-Stub. **Deferred:** echter Docker/Podman + Traefik-Routing (eigene `later/`-Roadmap).

## Council-Notizen
- Worktree-Lifecycle = Session-Lifecycle (Diff vom Agent-Lauf fällt geschenkt raus).
- Container nicht vor den agent-nativen Kern ziehen (Konzept §8 value-first).
