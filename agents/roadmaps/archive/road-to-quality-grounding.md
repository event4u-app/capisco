---
status: complete
block: Backend
depends_on: [road-to-session-store-and-acp]
unlocks: [road-to-task-forge]
autonomy: "A (runner) / B (AI-review deferred)"
---

# Road to Quality-Grounding (B5)

**Goal:** Quality-Tool-Runner im Workspace → strukturierte Diagnostics, die die KI **erden**
(„fast richtig" → verifiziert). Runner real & auto-verifizierbar (eslint/tsc/vitest sind da);
der LLM-Review-Teil deferred (Keys).

## Akzeptanz
- `QualityProvider`: läuft Tool im Worktree, parst Output → `SignalItem(source:"lint")`/Diagnostics + anwendbare Fixes. Gegen Fixture-Dateien verifiziert (real, kein Fake).
- Ehrlichkeit: KI-Review-Loop (Tool-Fakten → LLM) hinter Interface; LLM-Aufruf deferred.

## Phase 0 — Runner
- [x] Tool-Runner-Abstraktion; eslint + tsc + vitest gegen Fixtures → Diagnostics in die Signal-Fläche.
- [x] Sprach-Pack-Form (phpstan/rector/ecs etc.) als Interface; konkrete Packs deferred.

## Phase 1 — KI-Review (Interface, deferred)
- [x] Review-Loop „erst Tools, dann LLM auf Tool-Fakten" als Interface + Fake; echter LLM-Call deferred (Keys).
