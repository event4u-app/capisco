---
status: ready
autonomy: "P0 (Tauri-ACL) autonom fixbar, nativ-verifiziert durch Matze. P1/P2/P5 (Backend-Wiring, Send-Loop-Ehrlichkeit, Mock-Stream) autonom baubar + Playwright/vitest-verifizierbar im Browser. P3/P4 (per-Session-Backend + Mid-Chat-Switch-UI) autonom baubar. Echter Agent-Lauf bleibt real-runtime-gated (Klasse-B) + 238-Bildschirm-Abnahme."
---

# Road to: Shell & Chat really work

Matze meldet echte Funktionsbugs: Fenster nicht per Button max/min/resize, nicht
per Titelleiste verschiebbar; Chats/Agents „nicht real"; kein Agent/CLI-Wechsel im
Chat; „zig Fehler". Diese Roadmap ist das Ergebnis einer Reproduktions- +
Code-Analyse (2 parallele Analyse-Agents + Playwright-Browser-Reproduktion), nicht
geraten. Jede Zeile nennt die Root-Cause mit `file:line`.

**Test-Strategie (echter-Entwickler-Modus):** jeder browser-verifizierbare Fix
bekommt einen Playwright- **oder** vitest-Test, der das Verhalten beweist; ich
fahre den Dev-Server (`pnpm dev`, 5173 + Bridge 8787) und treibe die UI selbst.
Native Fenster-Controls (Tauri-Webview) + der echte Agent-Lauf sind NICHT
browser-testbar — dort liefere ich Guard-/Wiring-Tests + Du verifizierst nativ.

## Phase 0 — Native-Fenster-Shell (Tauri-ACL)  [nativ-verifiziert]

Root-Cause (hohe Konfidenz): `app/src-tauri/capabilities/default.json` gewährt nur
`core:default` — in Tauri v2 ein **read-only** Fenster-Set. Die state-ändernden
Kommandos + Drag sind nicht gewährt → `getCurrentWindow().minimize()/.toggleMaximize()/
.close()` und `data-tauri-drag-region` werden von der ACL abgelehnt; die Rejection
wird vom `void closeWindow()` (TitleBar.tsx) still verschluckt → Button tut nichts.
`isTauri()` (v2 injiziert `__TAURI_INTERNALS__` immer) + `decorations:false` sind korrekt.

- [x] `capabilities/default.json`: `permissions` um `core:window:allow-minimize`,
      `-maximize`, `-unmaximize`, `-toggle-maximize`, `-close`, `-start-dragging`
      erweitern. <!-- done: die 6 Permissions gesetzt (default.json). -->
- [x] Guard-Test (vitest): die Capabilities-Datei enthält die 6 Window-Permissions
      (Regressions-Lock). <!-- done: sidecar/test/tauri-capabilities.test.ts (node-env, liest die Config). -->
- [x] TitleBar-Wiring-Test (vitest, `isTauri`+window-controls gemockt): Klick auf
      close/min/max ruft die je richtige Funktion; Browser (isTauri false) → dekorative Spans. <!-- done: src/shell/TitleBar.test.tsx (+ window-controls.test.ts no-op-Contract). -->
- [x] `tauri.conf.json`: Fenster-`label: "main"` explizit setzen (Härtung). <!-- done. -->
- [ ] Native Real-Abnahme (Matze): `pnpm tauri dev` → close/min/max + Titelleisten-
      Drag bewegen das echte Fenster. <!-- nicht browser-testbar; Tauri-Webview → Deine Bildschirm-Abnahme -->

## Phase 1 — Echte Backend-Auswahl (detect → Katalog → select → Redetect/Save)

Der Backend-Picker ist heute kosmetisch: er schreibt einen lokalen String, ruft
`detect()` nie, zeigt einen statischen Mock-Katalog, und `onUse` erreicht den
Sidecar `select()` nie → jeder Lauf läuft gegen „no backend".

- [x] **detect() beim Desktop-Boot** für das Composer-Label (`current()`) auf der
      **Bridge** (A3): Der Composer fragt `current()` vor dem Öffnen des Gears →
      `BackendSelection` war nie detektiert → „no backend" trotz echtem Backend.
      Fix: die Wire-Handler `current`/`select` rufen `ensureDetected()` (scannt den
      Host genau einmal, `#hasDetected`). Erste UI-Lesung self-healt zum echten
      Label; der per-Session-Re-Select (B3) trippt nicht mehr „run detect() first".
      Sidecar-Tests: 14 grün. <!-- done: backend-selection.ts ensureDetected + main.ts wire (A3). C4 (Frontend-Label-Deps) bleibt P2. -->
- [x] **Picker aus echtem detect()** speisen statt statischem `agentSnapshot.backends`:
      AgentSettings holt den Katalog per `agentBackend.detect()` (on-mount + Redetect);
      der Mock-`detect()` liefert jetzt den vollen deterministischen Katalog → der
      Picker ist provider-getrieben (Browser wie Desktop). <!-- done: AgentSettings.tsx + mock-providers.ts -->
- [x] **`onUse` → `agentBackend.select(id)`** verdrahtet (+ lokaler Set fürs UI) —
      die lasttragende „Wechsel tut nichts"-Ursache B3 behoben. <!-- done -->
- [x] **Redetect-Button** `onClick → detect()` (hatte keinen onClick). <!-- done -->
- [x] **Save persistiert das API-Token** (braucht Secret-Store): neuer write-only
      `credentials`-Provider (`put`/`has`, **kein** Read-Pfad — spiegelt die
      SecretStore-Invariante), verdrahtet über `broker.secrets` (Keychain/0600-File).
      AgentSettings-Save `put`et den Token + zeigt „stored"; Mount-`has()` markiert
      einen vorhandenen Token maskiert. Tests: Sidecar-Factory gegen echten
      InMemorySecretStore (put→inject, kein Getter, Replace) + AgentSettings
      Save→put/leerer-Save/Mount-has. <!-- done: credentials-provider.ts + main.ts wire + providers/mock + AgentSettings -->
- [x] **AgentSettings liest `selectedBackendId`/`setSelectedBackend` aus Props**
      statt hart `useAgents` (B4 — schrieb im Chat-Workspace sonst in den falschen
      Store; jetzt fädelt AgentWorkspace den per-Session-Wert durch). <!-- AgentSettings.tsx Props (B4) -->
- [x] Tests: vitest `AgentSettings.test.tsx` (Spy-Provider: detect on-mount, onUse→select,
      Redetect→detect — grün); Browser-Katalog-Population deckt `agents.spec.ts:187`
      (Playwright) ab. Der Klick-Select-Flow ist im Mock nicht browser-testbar (nur
      `stub` ist `ready` + bereits selektiert) → per vitest bewiesen. <!-- done -->

## Phase 2 — Send-Loop-Ehrlichkeit (kein Fake-Endlos-Spinner)

`runSend` setzt `loading` **bedingungslos vor** dem Real-Dispatch-Guard; im Browser/
Mock/Chat wird `sendPrompt` nie gerufen und `completeRun` **nie** — der Spinner dreht
für immer, der Stop-Button erscheint. Das ist ein Hauptgrund für „Chats gehen nicht".

- [x] `loading` nur setzen, wenn ein echter Lauf dispatcht wird. <!-- done: runSend setzt loading NACH dem `if(!text) return`; leerer Send spinnt nicht mehr; der Mock-Pfad completet via `completeRun` (AgentWorkspace.tsx runSend). -->
- [x] Queue-Drain: `completeRun` auf dem Mock-Pfad gerufen → `runCompletions` bumpt →
      `useQueueDrain` feuert; gequeuete Nachrichten draint im Browser. <!-- done (Browser); der echte Desktop-Pfad completet weiter via Real-Stream (real-runtime). -->
- [x] Live-Label-Effekt-Deps um Bridge-Install ergänzen, damit das Backend-Label
      nach Bridge-Swap nicht stale ist (C4): `connectDevBridge()` installiert die
      Bridge **async nach dem Boot** — ein einmaliges `isDesktop()` beim Mount blieb
      auf dem Mock-Label hängen. Fix: `subscribeBridge`-Emitter in `desktop-shell`
      (feuert bei install/clear) + `useBridgeReady()`-Hook (`useSyncExternalStore`);
      der Live-Label- **und** der B3-Re-Select-Effekt gaten jetzt auf `bridgeReady`
      und re-rennen, sobald der echte Sidecar da ist. <!-- done: desktop-shell.ts + use-bridge.ts; AgentWorkspace-Effekte (C4) -->
- [x] Tests: Playwright (`test/visual/agent-send.spec.ts` — senden → Antwort + Settle,
      selbst gefahren, grün) + vitest (Composer.send Case B: Mock dispatcht + settelt;
      Empty-Send spinnt nicht). <!-- done -->

## Phase 3 — Per-Session-Backend + Mid-Chat-Agent/CLI-Wechsel

Backend-State ist heute global (`backendKind`/`selectedBackendId` als Top-Level-
Store-Felder), nicht per Session; es gibt kein Inline-Switch-UI (nur das Gear-Popover).
„Im Chat wechseln" hat weder Speicherort noch Oberfläche.

- [x] Per-Session-Backend-Binding: `selectedBackendIdBySession: Record<string,string>`
      im Store + `setSessionBackend`, durch AgentWorkspace→AgentSettings gefädelt
      (das Gear-Popover ist jetzt der per-Session-Umschalter). `sendPrompt` hat kein
      Backend-Arg → die Bindung wirkt über den Re-Select-Effect (B3), nicht über ein
      Prompt-Feld. <!-- store.ts:170,385; AgentWorkspace.tsx:481 (B1) -->
- [ ] Inline-Switch-UI: ein Backend-Chip/Dropdown auf der Composer-Bar oder im
      SessionTabbar (UX-Kür — der per-Session-Wechsel funktioniert bereits übers
      Gear; Playwright-Chip-Test zieht mit diesem Item). <!-- Composer.tsx:926; AgentSettings.tsx:131 (B2) -->
- [x] Bei Session-Wechsel den Sidecar-Backend re-selektieren (per-Session → select()):
      Effect keyed auf den aufgelösten `sessionBackendId`, feuert bei Switch + In-Place-
      Rebind. Ohne das wäre die per-Session-Wahl kosmetisch. <!-- AgentWorkspace.tsx:226 (B3) -->
- [x] Tests: vitest per-Session-State (`store.s9.test.ts` — Sessions unabhängig) +
      AgentSettings-Pick→Setter (`AgentSettings.test.tsx`). Playwright-Chip zieht mit B2. <!-- done -->
- [x] Verifikation: `tsc -b --noEmit` clean, targeted + full vitest grün (1157),
      eslint 0 errors (1 pre-existing Warning), Visual 96 + Golden byte-identisch. <!-- done -->
- [ ] Native-Check (Matze): im Desktop-Build zwei Chats mit verschiedenen Backends
      belegen, wechseln, senden → jeder Chat läuft gegen sein Backend.

## Phase 4 — Chat-Kind-Ehrlichkeit

Der `kind:"chat"`-Workspace ist per Design mock-only (`!isChat`-Guards), zeigt aber
einen interaktiven Composer, der still no-oppt — vom „kaputt" ununterscheidbar.

- [ ] Produkt-Entscheidung (Matze): entweder einen echten tool-losen Chat-Lauf für
      `kind:"chat"` verdrahten ODER Chat sichtbar als nicht-ausführend markieren. <!-- AgentWorkspace.tsx:261; Transcript.tsx:252,258 (A2) -->

## Phase 5 — Browser-Mock streamt eine echte Antwort (Dev/Demo-Erlebnis)

`mockAgentProvider.sendPrompt` ist ein No-op — im Browser/Dev fühlt sich jeder Chat
tot an. Ein deterministischer Fake-Stream (User-Turn → gestreamte Agent-Antwort →
Completion) macht die App im Browser demonstrierbar + testbar, ohne echtes Backend.

- [x] `mockAgentProvider.sendPrompt` hängt User+Agent-Block an `BLOCKS[id]` an +
      notifiziert Live-Subscriber (Listener-Registry) → Transcript zeigt die Antwort,
      der Lauf settelt via `completeRun` (schließt auch C1 im Browser). Die Antwort
      ist klar als Mock gelabelt. <!-- done: mocks/agents.ts sendPrompt + subscribe-Registry -->
- [x] Tests: Playwright (`agent-send.spec.ts`) — tippen → senden → Mock-Antwort
      erscheint → User-Turn erscheint → Send-Button verlässt `data-running` (settelt).
      Selbst gegen Preview gefahren, grün. (Der ECHTE Claude-Lauf bleibt real-runtime + 238.)

## Nicht in Scope (gegated — dieselbe Klasse wie der Rest von real-runtime)

- Echter Ende-zu-Ende-Claude-Lauf (native Backend-Select + Projekt-öffnen + Broker-
  gegateter Write) — real-runtime, 238-Bildschirm-Abnahme durch Matze.
- Native Fenster-Verifikation — Tauri-Webview, nicht Playwright-Browser-testbar.
