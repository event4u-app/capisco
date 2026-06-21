---
status: complete
block: Backend
depends_on: []
unlocks: [road-to-tauri-sidecar, road-to-real-git, road-to-session-store-and-acp]
autonomy: A
---

# Road to Backend-Contracts (B-pre)

**Goal:** `app/src/contracts/` von synchron/Snapshot auf **async + streaming** heben, damit echte
Provider (Git/ACP/IPC) ohne UI-Umbau andocken. Mocks + UI-Consumer mitziehen, alle Gates grün.

> Council-P1 (alle drei Linsen): die heutigen Interfaces sind die „architecture-level lie" — sync
> snapshot-pull, wo real streaming/async nötig ist. Vor jedem echten Backend fixen.

## Akzeptanz
- `tsc -b · lint · vitest · build · ladle · playwright` grün (UI unverändert sichtbar; nur Daten-Layer-Form ändert sich).
- Jeder geänderte Provider hat einen Async-Fake + Test; kein UI-Consumer pollt mehr, wo Events passen.

## Phase 0 — Async + Streaming
- [x] Alle Provider-Methoden `Promise<…>`; UI-Consumer auf async (loading states existieren bereits). <!-- AgentProvider/EditorProvider/SignalProvider + neue GitProvider/TasksProvider/WorkspaceProvider async; Streaming-Fläche nutzt subscribe, Snapshot-Views nutzen synchrone *Snapshot-Facaden (DECISIONS.md). -->
- [x] **Event/Subscribe-Kanal** für Sessions: `subscribe(sessionId, cb)` / async-iterator für Token-Deltas, Status-Transitions, Tool-Call-Events (ACP-shaped). Mock emittiert deterministische Event-Folge. <!-- SessionEvent-Union + subscribe()→Unsubscribe; deterministischer Replay auf Microtask; Tests in backend-contracts.test.ts. -->

## Phase 1 — Permission-Resolution + Telemetrie + Worktree-Modell
- [x] `PermissionRequest` bekommt **`resolve(decision)`-Rückkanal** + Grant-Achse (`once|session|scoped|deny`); Broker persistiert Grant. <!-- resolvePermission()→GrantAxis; once=single-shot, kein forever-Wert im Typ; fromUntrusted-Flag für lethal-trifecta-Gate. -->
- [x] **Strukturierte Telemetrie** (`tokensIn/tokensOut/runtimeMs`), aggregiert Parent←Subagent; UI rendert daraus (statt vorgerenderter Meta-Strings, in Goldens maskiert). <!-- Telemetry-Shape + aggregateTelemetry + formatTelemetry; s1-Tab zeigt aggregierte 7.7k. -->
- [x] **Repo ≠ Worktree**: `workspace.Project` splitten in `Repo` (Remote/Default-Branch) + `Worktree` (Pfad/Branch/Base). Explorer/Changes mappen auf Worktree. <!-- Repo+Worktree+Project-Alias; mockRepos/mockWorktrees; mockProjects=mockWorktrees-Alias. -->

## Phase 2 — Security-Shapes + Verzweigung + History-2
- [x] **`Datasource.readonly` → abgeleitete Invariante** (`readonly = env==="production"`, non-optional, nicht settable) + `WriteEscape`-Form (per-Befehl-einmal). **Kein settbarer Toggle.** <!-- makeDatasource() friert ein + derived readonly; WriteEscape/makeWriteEscape single-shot; settbarer Toggle entfernt. -->
- [x] **Session-Tree als Baum** (retry verzweigt, §2.2) statt flacher `TranscriptBlock[]`-Liste. <!-- SessionTree/SessionNode + getTree/branch(); branch graftet Geschwister, überschreibt Parent nie. -->
- [x] **History-2 Shadow-Store-Interface** (§5.1) — Snapshot bei Save/externer Änderung, getrennt von Git. <!-- ShadowStore + createInMemoryShadowStore (append-only, deterministischer seq); mockShadowStore mit save→external→save-Timeline. -->

## Verifikation (B-pre, frische Gates)
- `pnpm exec tsc -b` · `pnpm lint` (0 errors) · `pnpm exec vitest run` (72 passed, +18 Backend-Contracts) · `pnpm build` · `pnpm exec ladle build` · `pnpm exec playwright test` (83 passed) — alle grün. UI sichtbar unverändert; nur die Daten-Layer-Form änderte sich. color-contrast bleibt getrackt (nicht gegated).

## Council-Notizen
- `AgentProvider` sync→async+subscribe ist der größte Mismatch (Lens A+B).
- `Datasource.readonly?: boolean` optional = Security-Smell → derived invariant (Lens C, sofort).
