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

- [ ] **detect() beim Desktop-Boot** aufrufen + `current()` daraus ableiten (heute
      nie gerufen → `current()` = „no backend"). <!-- backend-selection.ts:100; AgentWorkspace.tsx:199-220 (A3) -->
- [ ] **Picker aus echtem detect()** speisen statt `agentSnapshot.backends` (statischer
      Mock, disconnected von der Sidecar-Realität; Mock bleibt Browser-Fallback). <!-- AgentSettings.tsx:47 (A4) -->
- [ ] **`onUse` → `agentBackend.select(id)`** (+ detect-if-needed) verdrahten; heute
      reiner lokaler `set` (B3, die lasttragende „Wechsel tut nichts"-Ursache). <!-- store.ts:377; AgentSettings.tsx:194; einziger .select(-Caller ist main.ts:127 -->
- [ ] **Redetect-Button** `onClick → detect()` (heute kein onClick) + **Save** persistiert
      das API-Token statt es zu verwerfen. <!-- AgentSettings.tsx:180,168 (C5) -->
- [ ] **AgentSettings nutzt den parametrisierten `useStore`** statt hart `useAgents`
      (im Chat-Workspace schreibt das Backend-Segment sonst in den falschen Store). <!-- AgentSettings.tsx:49-50 (B4) -->
- [ ] Tests: vitest mit Spy-Provider (onUse ruft select; Boot ruft detect; Redetect
      ruft detect; Save persistiert) + Playwright (Picker füllt sich aus detect,
      Auswahl spiegelt sich im Status). <!-- UI-Wire browser-testbar; echter Lauf native -->

## Phase 2 — Send-Loop-Ehrlichkeit (kein Fake-Endlos-Spinner)

`runSend` setzt `loading` **bedingungslos vor** dem Real-Dispatch-Guard; im Browser/
Mock/Chat wird `sendPrompt` nie gerufen und `completeRun` **nie** — der Spinner dreht
für immer, der Stop-Button erscheint. Das ist ein Hauptgrund für „Chats gehen nicht".

- [x] `loading` nur setzen, wenn ein echter Lauf dispatcht wird. <!-- done: runSend setzt loading NACH dem `if(!text) return`; leerer Send spinnt nicht mehr; der Mock-Pfad completet via `completeRun` (AgentWorkspace.tsx runSend). -->
- [x] Queue-Drain: `completeRun` auf dem Mock-Pfad gerufen → `runCompletions` bumpt →
      `useQueueDrain` feuert; gequeuete Nachrichten draint im Browser. <!-- done (Browser); der echte Desktop-Pfad completet weiter via Real-Stream (real-runtime). -->
- [ ] Live-Label-Effekt-Deps (`AgentWorkspace.tsx:220`) um Bridge-Install/`isDesktop`
      ergänzen, damit das Backend-Label nach Bridge-Swap nicht stale ist. <!-- (C4) offen; landet mit P1 (detect/select). -->
- [x] Tests: Playwright (`test/visual/agent-send.spec.ts` — senden → Antwort + Settle,
      selbst gefahren, grün) + vitest (Composer.send Case B: Mock dispatcht + settelt;
      Empty-Send spinnt nicht). <!-- done -->

## Phase 3 — Per-Session-Backend + Mid-Chat-Agent/CLI-Wechsel

Backend-State ist heute global (`backendKind`/`selectedBackendId` als Top-Level-
Store-Felder), nicht per Session; es gibt kein Inline-Switch-UI (nur das Gear-Popover).
„Im Chat wechseln" hat weder Speicherort noch Oberfläche.

- [ ] Per-Session-Backend-Binding: `backendBySession: Record<string,string>` (oder
      `backendId` auf `Session`/`StoredSession`), durch `sendPrompt` gefädelt. <!-- store.ts:164,167 (B1) -->
- [ ] Inline-Switch-UI: ein Backend-Chip/Dropdown auf der Composer-Bar oder im
      SessionTabbar, an den per-Session-Setter verdrahtet. <!-- Composer.tsx:926; AgentSettings.tsx:131 (B2) -->
- [ ] Bei Session-Wechsel den Sidecar-Backend re-selektieren (per-Session → select()).
- [ ] Tests: vitest (per-Session-State) + Playwright (Chip wechselt Backend, Status folgt).

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
