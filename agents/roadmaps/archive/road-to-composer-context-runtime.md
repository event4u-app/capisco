---
status: ready
block: Token-Ökonomie / Runtime
depends_on: [road-to-design-sync-v2, road-to-session-store-and-acp, road-to-capability-broker, road-to-worktree-runtime]
autonomy: "A (Verdrahtung/Selektoren) / B (File-Dialog hinter DesktopShell-Interface) / C (Ingestions-Nutzen + Cancel-Verhalten = Sicht/Verhaltens-Abnahme)"
council: "3 Linsen (Architektur · Autonomie · Security) — Befunde unten verankert"
---

# Road to Composer-Context-Runtime — die v2-UI-Stubs verdrahten

**Goal:** Die in `road-to-design-sync-v2` als **Stub/No-op** angelegten Composer-Flächen mit
echten Datenpfaden verbinden: Datei→Context-Ingestion (`+`-Add **und** Drag&Drop), der
**System-File-Dialog** (hinter dem `DesktopShell`-Interface, nicht roh Tauri in der Shell),
**Send→Stop** als echter Session-Cancel, das **Revert** (Code-Hunk im Worktree, broker-/
B1-konform) und die **echte Rules-Char-Zählung** statt des hartkodierten 99.024-Schwellwerts.

> Referenz: `agents/tmp/design-update-v2.md` §1/§3/§4, Roadmap-A-Stubs (dort als
> „Roadmap B" benannt), Overview §2 Invarianten (§2.3 Ehrlichkeit über Grenzen).

> **Council-Grenze (Architektur · Security):** Datei-Ingestion und File-Dialog berühren die
> **Capability-Achse** — eine angehängte Datei ist ein Context-Lesezugriff, der **Datasource-/
> Secret-Invarianten** respektieren muss (Secrets nie in den LLM-Context; prod read-only).
> Der File-Dialog läuft **hinter `DesktopShell`** (Overview Decision-Gate „Shell-Träger":
> keine rohen Tauri-APIs in der Shell), mit Browser-`<input type=file>`-Fallback.
> **Revert** ist **Code-Hunk-Verwerfen im Worktree, nie Seiteneffekt-Undo** (§2.3) — und
> läuft über die git-autoritative Schicht (B1-Disziplin: `execFile`, argv-Array, kein Shell).

> **Council-Befund (claude-sonnet-4-5 + gpt-4o, 2026-06-22, 2 Runden) — in diese Roadmap
> gefaltet:** (1) Der **File-Ingestion-Contract** ist die höchstpriorisierte Vorarbeit und
> ein **Sequencing-Blocker** für die UI *und* die Tests — er wird als blockierende Phase 0
> vorangestellt. (2) `+`-Add, Drag&Drop, Chips und das Rules-Warn-Icon kommen **aus
> design-sync-v2 hierher** und shippen **UI+Funktion zusammen** (Council: „incremental
> integration", keine lügenden Stubs in A). (3) Die Pflicht-Tests werden um die **Attack-
> Surface** (Tests 4–6) erweitert — die Happy-Path-Asserts allein fangen die Regressionen nicht.

## Akzeptanz

- **Pflicht-Tests (Council — sonst rottet Sicherheit/Ehrlichkeit still):**
  1. **Ingestion-Invariante:** Eine angehängte Datei aus einer `prod`-Datasource / mit
     Secret-Form wird **nie** roh in den Context-Payload gelegt — Referenz oder Refusal,
     nie der Wert (gleicher Geist wie Broker-Secret-Invariante).
  2. **Revert-Ehrlichkeit-Assert:** Revert verwirft **nur** den Code-Hunk im Worktree;
     Tooltip/Audit benennen die Grenze; kein Seiteneffekt-Undo behauptet. Revert läuft durch
     die git-autoritative Schicht (nie RTK/heuristisch).
  3. **Cancel-Assert:** Send→Stop bricht **diese** Session ab (Session-Store `cancel`),
     mutiert den Parent nie (B3-Tamper-Disziplin), kein Auto-Resume.
  4. **Ingestion-Refusal-Attack-Assert** (Council 2026-06-22): `+`-Add **und** Drag&Drop
     laufen durch **denselben** Ingestions-Code-Pfad — ein Test beweist, dass keiner der
     beiden Pfade das Secret-/prod-Scanning umgeht (ein eingeschleuster Secret-/prod-File
     wird auf **beiden** Wegen refused).
  5. **Prod-read-only-at-ingestion-Assert:** Die prod-read-only-Invariante wird **an der
     Ingestions-Grenze** geprüft, nicht erst beim Read — ein prod-stammender File trägt das
     Tag bis in den Refusal/Reference, nie als roher Wert.
  6. **Revert-argv-Isolation-Assert:** Der Hunk-Revert ruft git mit **argv-Array** (`execFile`,
     kein Shell) — ein Test mit einem Pfad, der Shell-Metazeichen enthält, beweist, dass keine
     Interpolation/Injection möglich ist.
- **Menschliche Abnahmen (Klasse C):** Ingestions-*Nutzen* (was landet wirklich im Context) ·
  Cancel-Verhalten (UX beim Abbrechen mitten im Stream) · File-Dialog-Gefühl (Desktop vs.
  Browser-Fallback).
- **Degrade:** Kein Desktop-Träger → Browser-`<input type=file>`; kein Worktree → Revert
  disabled mit ehrlichem Hinweis, kein Hard-Fail.

## Decision-Gates (PO — Council bei Rückfrage)

| Gate | Default-Vorschlag | Quelle |
|---|---|---|
| Datei-Ingestions-Tiefe | **Pfad-Referenz + on-demand-Read durch das Backend** (nicht voller Inhalt eager in den Payload) — spart Token, respektiert die Grounding-These | token-economy-Geist |
| File-Dialog-Träger | **`DesktopShell.pickFiles()`-Interface** (Tauri-Impl später), Browser-`<input>`-Fallback heute | Overview „Shell-Träger" |
| Rules-Char-Quelle | **Live-Summe** geladener Rules/Guidelines (gleiche Quelle wie der Agent-System-Context) | design-update-v2 §3 |

## Phase 0 — File-Ingestion-Contract (Pre-Work, **blockiert alle übrigen Phasen**)

> Council 2026-06-22: höchste-ROI-Vorarbeit, Sequencing-Blocker für UI **und** Tests. ~1 Seite.

- [x] **1-seitiges Contract-Doc** unter `agents/contexts/file-ingestion-contract.md` (durable;
      `agents/settings/contexts/` existiert in diesem Projekt nicht). Legt fest: „Datei" =
      **Pfad-Referenz + on-demand-Read** (kein Snapshot); **ein** Broker-Chokepoint für `+`-Add
      **und** Drag&Drop; prod-Tag at-ingestion + re-check at-read; Failure-Modes; Audit; plus die
      **Check|Wann|Wer**-Tabelle und die **Abuse-Case→Pflicht-Test**-Map (Threat-Pass-Output).
      <!-- agents/contexts/file-ingestion-contract.md -->
- [x] Contract reviewed (Klasse-C, Matze); erst danach starten Phase 1–5 (Code).
      <!-- Matze, 2026-06-23: Contract (5 Festlegungen: Pfad-Referenz, ein Broker-Chokepoint,
           Tag at-ingestion+re-check, Revert execFile/argv, Abuse→Test-Map) abgenommen → Start. -->

## Phase 1 — `DesktopShell.pickFiles()` + `+`-Add/Chips-UI (aus design-sync-v2 verschoben)

- [x] **`DesktopShell`-Interface** um `pickFiles({multiple})` erweitern; Browser-Impl =
      verstecktes `<input type=file>`; Desktop-Impl = Stub/deferred.
      <!-- src/lib/pick-files.ts: pickFiles() routet auf globalThis.__CAPISCO_SHELL__.pickFiles
           (Desktop, echte Pfade) sonst hidden <input type=file> (Browser, nur name, kein Pfad).
           hasDesktopFilePicker/install/clear-Hooks. -->
- [x] **`+`-Add-Button (Label „+", nicht „@") + Chips-Leiste** im Composer — **UI+Funktion
      zusammen** (Council: kein fake-Chip in A). Chip = Icon+Label, schließbar; `+` ruft
      `pickFiles`. Command-Palette `context:add`.
      <!-- Composer.tsx: addFilesViaPicker → pickFiles({multiple:true}) → Chips (mit path?);
           rohes hidden-input entfernt; usePalette register({id:"context:add"}). -->
- [x] DOM-/Unit-Assert: `+`-Add ruft `pickFiles`, nicht roh `input.click()`; Fallback grün;
      Chip add/remove.
      <!-- pick-files.test.ts (3: Desktop-Bridge, Browser-Fallback-Input, Cancel) + Composer.
           context.test.tsx (3: +-Add ruft pickFiles & kein input[type=file], picked→Chip,
           Chip-Remove). 44 Agents-Tests + 19 Visual-Specs grün, eslint 0, typecheck clean. -->

## Phase 2 — Datei → Context-Ingestion (`+`, Drag&Drop, Chips teilen einen Pfad)

- [x] Angehängte Dateien werden zu **Context-Einträgen** (Pfad-Referenz, Default: on-demand-
      Read durch das Backend), nicht eager voller Inhalt. `+`-Add **und** Drag&Drop teilen
      denselben Ingestions-Pfad.
      <!-- contracts/ingest.ts: ContextEntry{path,displayName,sourceTag} + IngestOutcome
           (reference|refused, KEIN content/value-Feld). Composer.ingestPaths() ist der eine
           Pfad; +-Add (Desktop-Pfade) und Drag&Drop (File.path) rufen beide getProviders().
           ingest.ingestFile. -->
- [x] **Ingestion-Invariante** (Pflicht-Tests 1, 4, 5): prod/Secret-Form → Referenz oder
      Refusal, nie der Wert; **beide** Pfade (`+`-Add **und** Drag&Drop) durch denselben
      Broker-Chokepoint; prod-Tag schon **an der Ingestions-Grenze** geprüft.
      <!-- sidecar/ingest/broker-ingestor.ts (BrokerIngestor): looksLikeSecretPath → Refusal
           +Deny-Audit VOR Read; tagForPath setzt prod:* at-ingestion; broker.authorize(file-read);
           gibt nur Referenz/Refusal zurück, nie Bytes. Pure Logik in src/lib/sidecar/ingest-core.ts
           (von Host + Browser-Mock geteilt = ein Chokepoint). sidecar/test/ingest.test.ts: 16 Tests
           (Test 1 Invariante, Test 4 ein-Chokepoint, Test 5 prod-at-ingestion). -->
- [x] DOM-Assert Drag&Drop legt einen echten Context-Eintrag an (nicht nur `.cmp-drag`);
      Invariante-Tests grün. Klasse-C: Ingestions-Nutzen-Abnahme **offen (Matze)**.
      <!-- Composer.context.test.tsx: Drop ruft denselben ingest.ingestFile (Spy) → Referenz-Chip;
           Secret-Drop → data-refused Warn-Chip. 595 Unit-Tests + 19 agents-Visual grün, build grün,
           eslint 0, typecheck (app+sidecar) clean. Klasse-C Sicht-Abnahme des Nutzens bleibt Matze. -->

## Phase 3 — Send→Stop (Visual **+** echter Session-Cancel; aus design-sync-v2 verschoben)

- [x] **Stop-State** (`square`, `.cmp-send.sending`) + Verdrahtung auf Session-Store `cancel`
      **zusammen** (Honesty-Gate: kein Stop-Icon ohne Abbruch). Beide Backends (native
      stream-json + ACP). Command-Palette `composer:stop`.
      <!-- Composer: lokales `sending` raus → parent-getriebenes `running` (runState==="loading")
           + `onStop`; Send-Button zeigt Stop nur bei laufendem Run (honesty-gate), Palette
           `composer:stop` während des Runs. AgentWorkspace.send() setzt runState loading;
           onStop=cancelRun. store.cancelRun ist backend-agnostisch (UI-Layer); der echte
           Stream-Abort reitet auf AgentProvider-unsubscribe wenn der reale Run-Loop subscribt. -->
- [x] **Cancel-Assert** (Pflicht-Test 3): bricht diese Session ab, Parent nie mutiert, kein
      Auto-Resume. Klasse-C: Cancel-UX im laufenden Stream **offen (Matze)**.
      <!-- AgentWorkspace.test.tsx: laufender Run → Stop (data-running); Klick cancelt NUR s1
           (s-parent bleibt loading), kein Auto-Resume; cancelRun idempotent + session-scoped.
           597 Unit-Tests + 24 agents/chat-Visual grün, build grün, eslint 0, typecheck clean.
           Klasse-C Cancel-UX-Sicht-Abnahme bleibt Matze. -->

## Phase 4 — Revert verdrahten (Code-Hunk im Worktree) + Glyph zeigen

- [x] `ToolAction.onRevert`-Handler + **Editor-Revert-Icon** → git-autoritativer Hunk-Revert im
      Worktree (B1: `execFile`, argv-Array, kein Shell). Revert-Glyph (schon aus design-sync-v2,
      Matze) ist jetzt funktional. Skipped (ehrlich) ohne Worktree.
      <!-- contracts/revert.ts (RevertProvider, RevertOutcome reference|skipped). sidecar/git/
           broker-reverter.ts (BrokerReverter, mirror fs-write-broker): broker.authorize(file-write)
           → execute(() => git checkout -- <path>); isRepo→skipped ohne Worktree. Provider in
           Bundle/Mock/IPC/Registry; register-dev-workspace swappt BrokerReverter bei Broker.
           Transcript.onRevertPath → getProviders().revert.revertPath(activeWorktree, target). -->
- [x] **Revert-Ehrlichkeit-Assert** (Pflicht-Test 2) + **argv-Isolation-Assert** (Pflicht-Test
      6): nur Code-Hunk, Grenze benannt, Audit-Record trägt die Aktion, kein Shell-Inject.
      <!-- sidecar/test/revert.test.ts (5): Test 2 (exakt `checkout -- <path>`, einmal, audited,
           skipped ohne Worktree, deny→skip), Test 6 (Pfad mit Shell-Metazeichen = EIN argv-Element,
           nie interpoliert). AgentWorkspace.test: Revert-Glyph-Klick ruft revert.revertPath(target). -->

## Phase 5 — Rules-Warn-Icon + echte Char-Zählung (aus design-sync-v2 verschoben)

- [x] **Rules-Warn-Icon** (`triangle-alert`) in der Chips-Leiste **mit** echter Zählung:
      Schwellwert aus der **Live-Summe** geladener Rules/Guidelines (gleiche Quelle wie der
      gesendete System-Context), statt eines hartkodierten Werts; Tooltip zeigt die echte
      Zahl + die Grenze. UI+Funktion zusammen (Honesty-Gate).
      <!-- AgentProvider.getSystemContextSize()→{chars,limit} (Contract+Mock+IPC-Proxy+
           live-agent-provider). Composer: hartkodierte RULES_CHARS/LIMIT raus → agentSnapshot.
           systemContext (gleiche Quelle wie der Provider); Warn flippt bei chars>limit. -->
- [x] Unit-Assert: Summe == System-Context-Länge; Warn-Icon flippt am echten Schwellwert.
      <!-- Composer.context.test.tsx (2): snapshot.systemContext === provider.getSystemContextSize()
           (eine Quelle) + Warn-aria-label trägt echte Zahl/Grenze; Warn flippt OFF wenn chars<limit.
           605 Unit-Tests + 24 agents/chat-Visual grün, build grün, eslint 0, typecheck (app+sidecar). -->
