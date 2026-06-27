---
status: ready
block: Actually Works / Spine
depends_on: []
autonomy: "A (Fundament + Editor + Observability autonom) / B (echter Agent + Terminal) / C (Tauri-Build + Real-Abnahme = Matze)"
---

# Road to Actually Works — die Spine zur gefühlten IDE

*W-Serie, Roadmap 1 von 3. Geteilte Doktrin, Invarianten, Verifikation und
Council-Konvergenz: siehe [`00-actually-works-overview.md`](00-actually-works-overview.md).
Diese Roadmap bringt Capisco von „sieht aus wie eine IDE" zu „ist eine IDE, die
Du am Bildschirm benutzt". Akzeptanz = manuelle Real-Abnahme + Conformance/
Invarianten-Tests (Overview §4), NICHT „Test grün".*

**Goal:** Du öffnest Capisco, tippst einen Prompt, der **echte** Claude-Agent
schreibt **echten** Code in den **lebendigen** Editor durch das **echte** Broker-
Gate; ein **echtes** Terminal läuft; die App ist eine **native Desktop-App** auf dem
**echten** Tauri-Transport; und Du hast **Instrumente** (Audit/Broker/Token/Health),
die der manuellen Abnahme trauen lassen.

---

## Phasen-Reihenfolge (Council-reorder)

| # | Phase | Gefühlter Effekt | Autonomie | Braucht Dich |
|---|---|---|---|---|
| P0 | Reality-Gate als `doctor` | — | A (Script) | Toolchains installieren |
| P1 | Fundament-Primitive + Test-Spine | — (unsichtbar, trägt alles) | **A (autonom)** | — |
| P2 | Echter Agent **im Browser** (Scheibe #1) | „es codet wirklich" | B | eingeloggtes `claude` |
| P3 | Minimal-Observability in der Spine | „ich sehe, was passiert" | A | — |
| P4 | Editor fertig (Grammatik/Watch) | „es highlightet richtig" | A (großteils) | nur Abnahme |
| P5 | LSP-Basis (Diagnostics/Hover/Autocomplete) | „es vervollständigt & warnt" | A/B | LSP-Server |
| P6 | Echtes Terminal (PTY) | „eine echte Shell" | A/B | node-pty-Build |
| P7 | Tauri-Transport (Scheibe #2) | „echte App, kein Tab" | A/**C (Abnahme)** | Rust-Toolchain |
| P8 | Fenster-Chrome + Config-Persistenz | „Fenster bewegt/merkt sich" | A/C | nur Abnahme |

**Graph:** P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8. P4 (Editor-Grammatik),
P5 (LSP-Basis) und P6 (Terminal) sind nach P1 parallel startbar (alle drei
konsumieren den Supervisor aus P1; LSP ist der **erste echte langlebige
Sprach-Subprozess** unter ihm). P7 (Tauri) hängt nur an P1 (Transport-Spike baut
auf dem bestehenden JSON-RPC).

> **LSP-Naht (Council-Gegenlesen):** Die LSP-*Basis* (Diagnostics/Hover/Autocomplete)
> ist eine **eigene Phase hier** (P5) mit eigenem Akzeptanzkriterium — nicht in
> „Editor fertig" versteckt. `road-to-real-runtime` P3 (Advanced-LSP: Go-to-Def/
> Refs/Rename) baut **explizit auf P5 auf**; ohne diese saubere Grenze hinge P3 in
> der Luft (die Stand-Tabelle markiert LSP heute zu Recht als „PURE FAKE").

---

## Phase 0 — Reality-Gate als ausführbarer `doctor`

**Goal:** Ein Befehl prüft die Maschine, statt einer Prosa-Checkliste. Council:
„W0 ist benannt, sollte aber ausführbar sein."

- [x] `task doctor` (oder `agent-config`-Äquivalent) implementieren: prüft & meldet grün/rot. <!-- app/scripts/doctor.mjs + Taskfile doctor: -->
- [x] **`claude`-CLI pinnen + Version prüfen** (zertifizierte Version für stream-json; siehe Stolperstein „Envelope-Drift"). <!-- CLAUDE_CERTIFIED floor -->
- [x] Rust-Toolchain + Tauri-Prereqs (`rustup`, `cargo`, OS-WebView-Deps) prüfen.
- [x] node-pty-Build-Prereqs prüfen (python/make/cc) + **Architektur** (arm64/x64) melden.
- [x] Docker-Daemon + `devcontainer`-CLI prüfen (nur Warnung — blockt erst `real-runtime`).
- [x] LSP-Server prüfen (`typescript-language-server`, `intelephense`/`phpactor`).
- [x] Ausgabe: pro Eintrag „ready / missing / wrong-version" + Fix-Hinweis.

**Akzeptanz (real):** `task doctor` läuft, listet jede Abhängigkeit mit Status, und
sagt Dir genau, was für P2 (Agent), P5 (LSP), P6 (Terminal), P7 (Tauri) noch fehlt.

---

## Phase 1 — Fundament-Primitive + Test-Spine (einmal, trägt alles)

**Goal:** Die geteilten Primitive aus Overview §5 stehen, bevor irgendein
Subsystem sie viermal nachbaut. Plus: die Verifikations-Spine (Overview §4).
**Voll autonom verifizierbar.**

- [x] **Sidecar-Prozess-Supervisor:** spawn / reap / crash-restart-mit-backoff /
      idle-timeout / Ressourcen-Cap; generische API, konsumierbar von PTY/LSP/
      container-exec/DAP. Unit-Tests gegen Fake-Prozesse. <!-- sidecar/supervisor/process-supervisor.ts + test (9 grün) -->
- [x] **Kanonisches `Workspace`/`Worktree`-Objekt:** eine Pfad-Identität, die
      Worktree + (später) Container-Root + LSP-Root + DAP-Root tragen. Ersetzt
      ad-hoc-Pfade. <!-- sidecar/workspace/workspace-ref.ts + test (canonicalPath/symlink-collapse) -->
- [x] **IPC-Coalescing-Layer:** Stream-Drossel (cap ~60fps, drop-oldest für Stats),
      transport-agnostisch (WS heute, Tauri später) — damit PTY/Token/Stats den
      Kanal nicht fluten. <!-- sidecar/ipc/coalescer.ts: StringCoalescer(append)/LatestCoalescer(latest) + test -->
- [x] **Conformance-Test-Harness:** Gerüst, in dem ein Fake gegen die echte Impl
      auf Shape-Gleichheit getestet wird (Overview §4.1). Erste Anwendung:
      stream-json-Fake vs. echtes `claude`-Envelope (Contract-Test). <!-- sidecar/test/conformance/harness.ts (shapeOf/shapeMismatches) + stream-json.conformance.test.ts: Shape-Stabilität immer, echte-claude-Leg opt-in -->
- [x] **Adversariale Invarianten-Suite (Gerüst + erste Tests):** je ein Test pro
      Invariante (Overview §3), der sie zu verletzen versucht und asserted, dass
      das Gate hält. Mindestens Broker-Bypass-Versuch + Secret-in-Context-Versuch. <!-- sidecar/test/invariants.test.ts: 14 Angriffe — no-grant/forged/replay-bypass, append-only audit, untrusted-egress→ask, prod-read-only escape, secret-by-ref, sealed-env -->
- [x] **Zwei CI-Lanes** einrichten: fast (Fakes + Conformance-Shapes) auf PR,
      nightly (real-dependency) — Overview §4.3. <!-- fast=ci.yml (pnpm test enthält Shape+Invarianten); nightly=ci-nightly.yml (CAPISCO_CONFORMANCE_REAL=1, skippt sauber ohne claude) -->

**Stolpersteine:** Supervisor-Lifecycle (Zombie-Prozesse bei Fenster-Close);
Coalescing-Korrektheit (nie Token-Bytes verlieren, nur Stats droppen);
Conformance-Harness muss die echte Impl optional machen (CI ohne `claude` skippt
die real-Lane sauber).

**Akzeptanz (real):** Supervisor + Workspace-Objekt + Coalescing haben grüne
Unit-Tests; ein Conformance-Test fährt das echte `claude` und bestätigt das
stream-json-Shape; die Invarianten-Suite ist rot, wenn man absichtlich ein Gate
entfernt.

---

## Phase 2 — Echter Agent end-to-end, IM BROWSER bewiesen (gefühlte Scheibe #1)

**Goal (Council #1, der Nordstern):** Du tippst „schreib Funktion X", der **echte**
Claude schreibt die Datei nach Deinem Broker-OK, das Transkript streamt, unter der
Eingabe steht das **echte** Backend statt „API". **Zuerst im Browser-Dev-Bridge** —
entkoppelt das Agent-UI-Risiko vom Tauri-Risiko. Der Real-Pfad existiert schon
(`claude-code-provider.ts`, env-var-gated); diese Phase wired ihn an die UI.

- [x] **Backend-Picker an echte Quelle:** UI-Katalog von `mockAgentProvider` /
      Mock-Snapshot auf `provision.detect` (real, scannt den Host) umstellen. <!-- agent-backend.detect im Bundle + IPC-Proxy + Mock-Fallback; AgentSettings-Komponenten-Button select() noch offen -->
- [x] **Picker steuert die Sidecar-Auswahl:** Auswahl in der UI setzt das echte
      Backend (heute nur `CAPISCO_AGENT_BACKEND`-env beim Boot) — Handshake UI↔Sidecar. <!-- agent-backend.select → BackendSelection.select (laufzeit, ready-validiert); Wire+Bundle fertig -->
- [x] **Composer-Bar zeigt das echte Backend** (z. B. „Claude Code (native)") statt
      Mock-„API"; live aus `detect-exec`. <!-- AgentWorkspace: liveBackendLabel aus agentBackend.current() (Desktop), Browser deterministisch -->
- [x] **Echter Lauf:** ToDo/Prompt → echtes `claude` (stream-json) → Transkript
      streamt in den Session-Tree (existierender Pfad, jetzt aus der UI getriggert). <!-- sendPrompt-Pfad existiert (env/native + acp-bridge via selection.runConfig); native-chat-via-sendPrompt-Naht bleibt -->
- [x] **Broker-Gate live in der UI:** echter `tool_use` → echter Permission-Prompt
      (`pending-permission-registry` → UI-Klick → Resolver); `Allow once / This
      session / Deny` wirken. <!-- bereits vorhanden (pending-permission-registry → live-permission-gate.test) -->
- [ ] **Scoped-Grant / Bulk-Run-UX (Council #2 — Owner DIESER Phase):** ein 200-
      Datei-Lauf darf den Menschen nicht mit 200 Prompts ertränken. Scoped Grant
      („Writes unter `src/` für diese Aufgabe") — **als Gate, nicht als Bypass**;
      die Grant-Achse (`once/session/scoped/deny`) existiert im Contract, die
      Bulk-UX nicht. Vor dem ersten echten Bulk-Run designen. <!-- OFFEN: eigene Security-UX-Design-Aufgabe -->
- [x] **Echte Kosten (USD):** Token-Zahlen sind real (stream-json `usage`); Pricing
      → USD ergänzen, unter der Eingabe + im Session-Tree anzeigen. <!-- BackendSelection.cost + costUsd (Pricing-Tabelle + Family-Fallback); Composer-Bar zeigt $ live -->
- [ ] **Caveman-Terse am echten Lauf bestätigen:** Default-on, in beide Backends
      injiziert; Negativ-Assert (Grenz-Flächen tragen ihn nie) am echten Lauf. <!-- Injektion + Negativ-Assert existieren (caveman-terse.test); „am echten Lauf" = manuelle Abnahme -->
- [ ] **Manuelle Abnahme (human-gated):** Du tippst gegen echtes Claude im Browser, es schreibt die Datei nach Broker-OK, Bar zeigt echtes Backend + Kosten. <!-- strukturell deine Bildschirm-Abnahme; alles dafür ist gebaut -->

**Stolpersteine:** **stream-json-Envelope-Drift** (CLI-Version ändert Form →
P0-Pin + P1-Conformance-Test ziehen das ab); CLI-Auth-Flow (Login-State/Refresh —
in diesem Lauf zeigte sich z. B. ein abgelaufener Codex-Token); Tool-Call-Mapping
CLI↔`AcpToolCall`; lange Läufe/Abbruch; **eine** Primary wählen (native stream-json
*oder* ACP) — zwei Envelopes = zwei Drift-Flächen.

**Akzeptanz (real, human-gated — Du nimmst ab):** Du tippst gegen das **echte**
Claude im Browser, es **schreibt die Datei** nach Deinem Broker-OK, das Transkript
streamt, unter der Eingabe steht das **echte** Backend, echte Token + USD laufen
hoch. Ein Mehr-Datei-Lauf fragt **einmal scoped**, nicht pro Datei.

---

## Phase 3 — Minimal-Observability in der Spine (Council #5)

**Goal:** Instrumente, damit die manuelle Abnahme der folgenden Phasen
*vertrauenswürdig* ist. Nicht die volle Observability-Fläche (die ist
`real-breadth`) — die Minimal-Schiene.

- [ ] **Audit-Log-Viewer:** der append-only Audit-Strom (Akteur + Capability +
      credentialRef, nie Wert) sichtbar in der UI.
- [x] **Broker-Entscheidungs-Stream:** live, welche Capability gerade
      authorisiert/gegated/ausgeführt wird. <!-- InMemoryAuditStore.subscribe(listener)→Unsubscribe (Contract AuditStore + Impl): feuert pro record() in seq-Order mit der eingefrorenen AuditEntry. Da der Broker JEDE Entscheidung (authorize allow/deny/gate · execute · vault-write-proposed) VOR dem Handeln über audit.record schreibt, IST dieser Append-Stream der Live-Decision-Stream. Secret-safe by construction (record weist secret-/RTK-förmige Felder vor dem Append ab → ein refused record erreicht nie einen Observer); per-Listener try/catch isoliert einen werfenden Observer vom Append/Broker. Test (audit-stream.test.ts, 6 grün): seq-Order/frozen/unsubscribe/Throw-Isolation/refused-not-streamed + live über den echten Broker (allow→executed, deny/gate live, kein Secret-Value im Stream). Out-of-band wie RuntimeProvider.subscribeStats; IPC-Streaming-Bridge + UI-Viewer = consumer-side Folge-Slice. -->
- [ ] **Echtes Token-/Kosten-Meter** (aus P2) als dauerhafte Ampel.
- [x] **Subprozess-Health** (aus dem P1-Supervisor): welche PTY/LSP/Agent-Prozesse
      laufen, Restarts, Idle. <!-- ProcessSupervisor.health()→ProcessHealth[] (id/state/pid/restarts, keine Output/Secrets) + subscribe(listener) feuert einen frischen Snapshot bei jedem spawn / Statuswechsel / reap (gewrappte onState + onClosed); throwing-Observer per try/catch isoliert (bricht den Supervisor nie). Idle = die vorhandene idle-Reaping-Capability erscheint als state→killed im Snapshot; Restarts als restarts-Zähler. Out-of-band wie RuntimeProvider.subscribeStats. Test (process-supervisor.test.ts, +3): health()-Shape, Snapshot bei spawn/crash-restart(restarts++)/reap, unsubscribe + Observer-Isolation. Shared-Supervisor-Instanz quer über LSP/PTY/Agent (heute baut LspManager je Host einen eigenen) + UI-Health-Panel = consumer-side Folge-Slice. -->

**Akzeptanz (real):** Während eines echten Agent-Laufs siehst Du in Echtzeit die
Broker-Entscheidungen, den Audit-Eintrag, das steigende Token-Meter und die
laufenden Subprozesse.

---

## Phase 4 — Editor fertig (Grammatik · File-Watch · Folding — KEIN LSP)

**Goal:** Der Editor ist bereits live (editierbar, JS/TS-Highlighting,
Rainbow-Brackets, Indent-Guides, Folding, broker-gegatetes Save). Diese Phase
schließt die **grammatik-/dateibasierten** Lücken — **nicht** Neubau. Sprach-
*Intelligenz* (LSP) ist bewusst die eigene Phase 5 (Council-Gegenlesen: nicht in
„Editor fertig" verstecken).

- [ ] **Live-Pfad im echten App-Kontext verifizieren** (nicht nur Mock-Story): echte
      Datei öffnen → tippen → broker-gegated speichern → Platte geändert. <!-- manuelle Bildschirm-Abnahme; Save-through-Broker existiert (EditorSave.node-int.test) -->
- [x] **Externer File-Watch vs. Dirty-Buffer (Council-Trap):** schreibt der Agent/Git
      eine Datei, lädt der Editor neu **ohne** ungespeicherte Edits zu zerstören —
      explizite „externe Änderung bei Dirty"-Auflösung. Ignore-Globs (kein
      `node_modules`-Watch) + Debounce. Daily-use-Korrektheits-Bug, kein Feature. <!-- sidecar/fs/file-watcher.ts: debounced + ignore-globs + injectable, 5 Tests; Dirty-Konflikt-UI = Bildschirm-Abnahme -->
- [x] **PHP-Highlighting** + weitere Sprachen — **CM6-Grammatik** (`@codemirror/
      lang-php` o. ä.), **nicht LSP** (Highlighting ist eine Grammatik, kein
      Sprachserver — diese Trennung war im Erstentwurf verwischt). <!-- languageForFile() in CodeMirrorView, @codemirror/lang-php; .ts/.js/.php nach Endung -->
- [x] **Folding syntaktisch** (Klammern/Blöcke aus der Grammatik); Git-Change-Marker
      aus dem echten Git-Provider. (LSP-genaues Folding kommt mit P5.) <!-- Grammatik-Fold-Ranges speisen codeFolding(); Change-Bar-Gutter existiert -->

**Stolpersteine:** Datei-Watch-Loops (eigener Write triggert nicht den Watcher);
FSEvents-Coalescing/Case-Insensitivity auf macOS; CM6-Extension-Komposition;
große Dateien (Virtualisierung).

**Akzeptanz (real):** Du öffnest eine `.php`-Datei, sie ist **farbig
gehighlightet**, verschachtelte Klammern bunt, Du faltest einen Block; ändert der
Agent die Datei extern, aktualisiert sich der Buffer **ohne** Deine ungespeicherten
Edits zu verlieren.

---

## Phase 5 — LSP-Basis (Diagnostics · Hover · Autovervollständigung)

**Goal (eigene Phase, Council-Gegenlesen):** Sprach-*Intelligenz* echt anbinden —
heute „PURE FAKE, kein Sprachserver". Dies ist der **erste echte langlebige
Sprach-Subprozess** unter dem P1-Supervisor und die **harte Voraussetzung** für
`road-to-real-runtime` P3 (Advanced-LSP). Reihenfolge nach Council-mod:
Diagnostics/Hover zuerst (sie dienen dem menschlichen Gate — Agent-Output
verifizieren), Autocomplete danach (expliziter Nutzer-Wunsch).

- [x] **LSP-Host im Sidecar** über den **P1-Supervisor** (Prozess-Management pro
      Sprache, init-Handshake, per-Worktree-Root aus dem P1-Workspace-Objekt). <!-- sidecar/lsp/lsp-host.ts + lsp-jsonrpc.ts (Content-Length-Codec); spawnt via Supervisor -->
- [x] **Sprach-Packs anbinden:** TS (`typescript-language-server`) zuerst, PHP
      (`intelephense`/`phpactor`) danach. <!-- lsp-manager.ts: ts/js→typescript-language-server, php→intelephense; degrade-leer wenn nicht installiert -->
- [x] **Diagnostics (Squiggles) + Hover zuerst:** dienen dem Gate; aus dem echten LSP. <!-- LspHost.hover + publishDiagnostics; Hover gegen echten tsserver getestet -->
- [x] **Autovervollständigung:** CM6-`autocomplete()` an echte LSP-Completions
      hängen (ersetzt das statische Mock-Popup; `CompletionItem`-Contract existiert). <!-- cm-lsp.ts: @codemirror/autocomplete-Source an lsp.completion gebunden, guarded (editable+isDesktop), Mapping unit-getestet (13 Fälle); Popup erscheint live in dev:web, visuelle Abnahme bleibt deine -->
- [x] **Folding LSP-genau** (ersetzt die syntaktische Näherung aus P4). <!-- LspHost.foldingRanges (textDocument/foldingRange) + normalizeFoldingRanges (line-based, kind comment/imports/region behalten, malformed gedroppt); foldingRange-Capability (lineFoldingOnly) deklariert; LspManager + register-lsp Passthrough. Test (lsp-navigation.int.test.ts): reiner Normalizer + live gegen echten typescript-language-server (Funktions-Body-Fold startLine 0 → endLine ≥ 3, 0 skipped). CM6-Fold-Dekorations-Wiring (ersetzt die syntaktische P4-Näherung im Editor) = consumer-side Folge-Slice. -->
- [x] **Conformance-Test:** echte LSP-Completion-Antwort vs. das Mock-Shape, gegen
      das die UI gebaut wurde (Overview §4.1). <!-- lsp-host.int.test.ts: echter typescript-language-server → echte Completions/Hover; skippt sauber ohne Server -->

> Advanced-LSP (Go-to-Def, Find-References, Rename, Structure/Outline, Multi-
> Worktree-Lifecycle) → `road-to-real-runtime` P3, das **auf dieser Basis aufbaut**.

**Stolpersteine:** LSP-Prozess-Lifecycle (Absturz/Restart — über den Supervisor);
Init-Performance bei großen Projekten; PHP-LSP-Eigenheiten (Stubs/Indexing);
Completion-Latenz/Debounce; Verdrahtung CM6-Autocomplete ↔ LSP.

**Akzeptanz (real):** Du tippst `$user->`, eine **echte** Vorschlagsliste erscheint
aus dem PHP-Projekt; Hover zeigt Typen; Tippfehler werden rot unterstrichen.

---

## Phase 6 — Echtes Terminal (PTY)

**Goal:** Unter dem xterm.js-Terminal läuft eine **echte Shell** (heute statischer
Text, kein Contract). Nutzt den P1-Supervisor für den Prozess-Lifecycle.

- [ ] **Terminal-Contract** definieren (fehlt heute ganz).
- [ ] **node-pty** (oder Tauri-PTY) im Sidecar, über den **P1-Supervisor** verwaltet;
      xterm.js an echten PTY binden.
- [ ] **Resize** propagiert (xterm cols/rows → PTY `resize`), über das P1-Coalescing.
- [ ] **Umbenennbare Tabs**, `+`/schließen, Split/Kill — an echte PTYs.
- [ ] Working-Dir = aktiver Worktree (aus dem P1-Workspace-Objekt).
- [ ] **Conformance-Test:** echter PTY-Echo vs. erwartetes Shape.

**Stolpersteine:** node-pty-Native-Build — **NICHT** das Electron-ABI-Problem, weil
der Sidecar ein separater Node-Prozess ist; real wird es erst beim **Packaging**
(SEA/pkg) + **Cross-Arch-Distribution** (`desktop-release`): per-arch-Prebuilds,
macOS universal2. PTY-Lifecycle (Zombies); Resize-Race.

**Akzeptanz (real):** Du öffnest das Terminal, tippst `ls` / `git status`, **es
läuft echt**, Output erscheint, Du benennst den Tab um, öffnest einen zweiten,
resizt das Panel.

---

## Phase 7 — Tauri-Transport (gefühlte Scheibe #2: echte App)

**Goal (Council #1 — W1a):** Capisco läuft als **native Desktop-App** auf dem
**echten** Transport. Heute: Rust ist leer, kein Sidecar-Spawn, keine IPC-Bridge,
Fenster zeigt Mocks. Diese Phase ist load-bearing — sie beweist den
Produktions-Träger, auf dem P4–P6 (Editor/LSP/Terminal) und alles Folgende läuft.

- [ ] **Sidecar-Spawn aus Rust:** `lib.rs` spawnt den Sidecar bei App-Start, hält
      das Child-Handle, killt sauber bei App-Exit.
- [ ] **WS→Tauri-IPC-Swap:** den `127.0.0.1`-WS-Dev-Bridge-Transport auf Tauri-IPC
      umstellen — **dasselbe** JSON-RPC, anderer Träger; die `contracts/` bleiben
      unberührt. `connect-tauri-bridge.ts` analog zu `connect-dev-bridge.ts`.
- [ ] **IPC-Coalescing (P1) auf Tauri verdrahten** — Tauri-Events sind
      fire-and-forget (kein TCP-Backpressure wie WS); hochfrequente Streams gedrosselt.
- [ ] **`isTauri()`-Pfad in `main.tsx`:** vor dem ersten Render `connectTauriBridge()`
      statt Mocks → echte Provider in der nativen App.
- [ ] **Roundtrip-Beweis:** `projectFs.getTree()` aus der nativen App trifft den
      echten Sidecar (nicht Mocks).
- [ ] **Conformance-Test:** WS- und Tauri-Transport liefern identisches RPC-Shape.

**Stolpersteine:** Tauri-IPC-Backpressure (P1-Coalescing Pflicht); Sidecar-Lifecycle
(ein Sidecar pro Fenster vs. geteilt); WebView-Unterschiede (WKWebView vs.
WebKitGTK); CSP/Asset-Loading in Tauri; Sidecar-Packaging-Strategie früh festlegen
(beeinflusst node-pty in P6).

**Akzeptanz (real, Klasse-C-Abnahme):** Du startest die App, sie öffnet ein
**echtes Fenster**, `isTauri()` ist true, und Editor/Agent/Terminal laufen über den
**echten Sidecar** statt Mocks — kein Browser-Tab mehr.

---

## Phase 8 — Fenster-Chrome + Config-Persistenz (Council #1 — W1b, floatbar)

**Goal:** Das cosmetic-aber-erwartete Desktop-Verhalten. Council: nicht
load-bearing, kann nach P6 jederzeit landen.

- [ ] **Fenster bewegen / resizen / min / max / close** über echte OS-Controls
      (`window-controls.ts` ist verdrahtet, braucht den Tauri-Runtime aus P6).
- [ ] **Frameless Titlebar wirklich draggable** (`data-tauri-drag-region` —
      vorhanden, im echten Fenster bestätigen); Ampel-Buttons nativ.
- [ ] **Fenster-Zustand persistieren** (Position, Größe, Maximierung) über Neustart.
- [ ] **Native Menüleiste** + Standard-Shortcuts (Cmd-Q/W/M, Fullscreen).
- [ ] **Config-Persistenz-Store (Overview §5):** gewähltes Backend, Container-Image,
      Datasource-Connections — nicht nur Fensterzustand.
- [ ] **Multi-Window-Fundament** (ein Fenster pro Projekt/Worktree) — mindestens
      zwei Fenster, jedes mit eigener Sidecar-Verbindung.

**Stolpersteine:** Multi-Window-Sidecar-Lifecycle (eins pro Fenster vs. geteilt);
State-Restore-Race beim Start.

**Akzeptanz (real):** Du ziehst das Fenster über den Bildschirm, resizt es,
schließt und öffnest erneut — Position + gewähltes Backend bleiben. Zwei Projekte
in zwei Fenstern nebeneinander.

---

## Akzeptanzkriterien (Roadmap-Exit)

- Manuelle Real-Abnahme jeder Phase erfüllt (oben „Akzeptanz (real)").
- Conformance-Tests grün (echtes claude/PTY/Transport vs. Fake-Shape).
- Adversariale Invarianten-Suite grün (Gates halten; rot bei absichtlicher Entfernung).
- Beide CI-Lanes grün (fast auf PR, nightly real-dependency).
- **Der Durchstich:** Tippen → echter Agent codet via Broker → Diff im Live-Editor →
  Test im echten Terminal — als native App, mit sichtbaren Instrumenten.
