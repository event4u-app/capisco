---
status: complete
block: Backend
depends_on: [road-to-tauri-sidecar]
unlocks: [road-to-worktree-runtime]
autonomy: A
---

# Road to Real-Git (B1)

**Goal:** Die Git-Mocks durch echte Git-Operationen ersetzen (status/diff/branches/stage/commit/log),
im Sidecar, gegen echte Repos — hermetisch gegen Temp-Repos verifiziert.

> Council: voll autonom + auto-verifizierbar (git ist vorhanden). Höchster Hebel im Backend.

## Akzeptanz
- `GitProvider` implementiert `workspace`-Contracts; Explorer/Changes/Commit/Diff laufen gegen echtes Git.
- Integrationstests: `git init` Temp-Repo → stage/commit/branch/diff/log → Assertions gegen Contract-Shapes. Hermetisch, deterministisch.

## Phase 0 — Read
- [x] Lib-Wahl (isomorphic-git vs shell-out/libgit2) als Decision-Gate; `status`, `diff` (Working/Staged/Branch-vs-Base), `log`, `blame`, Branch-Liste. <!-- Shell-out zu system `git` (Decision in app/DECISIONS.md). `GitOpsProvider` (contracts/git-ops.ts) + `RealGitProvider` (sidecar/git/) implementiert isRepo/status/diff{working,staged,base}/log/blame/branches/currentBranch. Reine Parser (git-parse.ts) + hermetische Temp-Repo-Tests. -->

## Phase 1 — Write
- [x] `stage`, `unstage`, `commit`, Branch create/checkout; Changes-Base-Resolution (PR-Target/Parent) real. <!-- stage/unstage/commit/branchCreate/checkout im RealGitProvider; RealWorkspaceProvider projiziert echtes Git in DiffDoc/ChangeSet/WorkStash/Worktree (Changes-Base = aktueller Branch role:parent). Über IPC-Spine verifiziert (real-git-ipc.test.ts). 53 neue Tests grün. -->

## Status
- [x] Alle Gates grün (tsc/lint/vitest 170/playwright 83/build/ladle); 53 neue hermetische Sidecar-Tests. **Status: complete** (kein Archive — Security/Human-Sign-off pending).

## Council-Notizen
- Gegen Temp-Repos testen (hermetisch) — kein Netz, kein User-Repo nötig (Lens B).
