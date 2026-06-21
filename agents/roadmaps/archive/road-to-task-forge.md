---
status: complete
block: Backend
depends_on: [road-to-quality-grounding]
unlocks: []
autonomy: "B (fixtures auto / live tokens deferred)"
---

# Road to Task-Forge (B6)

**Goal:** Task- (Jira/Linear) + Forge- (GitHub/GitLab) Provider → Ticket-Lifecycle = Worktree-
Lifecycle (§4.5/§4.6). Gegen **recorded Fixtures** auto-verifizierbar; Live-Tokens + bidirektionaler
Sync deferred.

> Council Lens C: bidirektionaler Sync ist 2–3× unterskaliert (Webhooks, Konflikte, divergente
> Status-Semantik). Mit *einer* Richtung beginnen.

## Akzeptanz
- `TaskProvider`/`ForgeProvider` mappen `Ticket`/`PullRequest` aus recorded JSON-Fixtures (`FixtureTaskProvider`/`FixtureForgeProvider`), verifiziert. **Live-Tokens deferred.**

## Phase 0 — Provider (Fixtures)
- [x] `TaskProvider` (Jira/Linear) + `ForgeProvider` (GitHub/GitLab) gegen Fixtures; „meine Tickets / nächstes aus Sprint ziehen"; „wessen Zug ist es".

## Phase 1 — Lifecycle (eine Richtung)
- [x] Ticket ziehen → Worktree+Session hoch → Status „In Progress"; fertig → Diff+Quality+Review → „In Review". **Nur lesend→eine Richtung schreibend**; voll-bidirektional deferred.

## Deferred (braucht Dich)
Echte API-Tokens (Jira/Linear/GitHub), Webhooks, bidirektionaler Sync.
