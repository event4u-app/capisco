---
status: complete
block: Backend
depends_on: [road-to-runnable-dev]
autonomy: "A (detect/UI/wire + broker-gated install logic) / B (real bridge install + live agent = user-approved)"
---

# Road to Agent-Provisioning (B8) — IDE installiert & richtet Agenten ein

**Goal:** Echte Agenten mit **minimaler Hürde**. Die IDE **erkennt** installiertes Agent-Tooling,
**hilft aktiv beim Installieren** (broker-gegatet, vom User bestätigt — nie still), und schaltet
den **ACP-Weg über `@zed-industries/claude-code-acp`** scharf, sodass die bereits eingeloggte
`claude`-CLI echte Sessions treibt. Dasselbe Muster erweiterbar auf Codex/Gemini/andere ACP-Agenten.

> Befund: `claude` (Claude Code 2.x) spricht kein ACP, sondern den SDK-Stream-JSON-Modus. Der
> ACP-Weg läuft über die Zed-Bridge `@zed-industries/claude-code-acp`, die ACP ↔ Claude Code
> übersetzt und den **bestehenden Claude-Login** nutzt (kein roher Key nötig). Unser ACP-Adapter
> spricht ACP — er muss nur die Bridge statt des Stubs spawnen.

## Akzeptanz
- **Detection** läuft echt auf dieser Maschine (erkennt `claude` + Version; node/npm/npx; ob `claude-code-acp` global/per npx verfügbar; Codex/Gemini falls vorhanden) → strukturierter Backend-Katalog mit Status `ready | installable | guide`.
- **Install** läuft **broker-gegatet**: der User bestätigt das exakte Kommando (append-only Audit, nie still) — verifiziert mit einem Dry/Echo-Kommando; echter Install ist User-approved.
- **ACP-via-Bridge**: der ACP-Adapter spawnt `claude-code-acp` (sealed subprocess, client-taint gelten); ACP-Init-Handshake verifiziert gegen einen **Fake-ACP-Bridge-Stub** (unsere Seite korrekt); echter Bridge-Run = User-approved (kann echten/bezahlten Claude-Call auslösen).
- **AgentSettings-UI** zeigt Backends + Status + Install/Use-Aktion; „Claude Code (via ACP)" wird wählbar, sobald `ready`.
- Security-Re-Audit: Installs sind konsequente Shell-Egress → Broker-Human-Gate (Lethal-Trifecta: keine Auto-Installs); Bridge-Spawn sealed.

## Phase 0 — Backend-Detection
- [x] `BackendProvisioner` (Sidecar): erkennt node/npm/npx, `claude` (+Version), `claude-code-acp` (global bin oder npx-verfügbar), optional codex/gemini; liefert `AgentBackend[]` mit `status` + `installCommand?` + `guideUrl?`. Reine Lese-Detection (kein Install).

## Phase 1 — IDE-assistierter Install (broker-gegatet)
- [x] „Install"-Aktion pro `installable`-Backend → Broker-`authorize`(shell) mit dem exakten Kommando (`npm i -g @zed-industries/claude-code-acp` bzw. npx-Warmup) → Human-Gate → `broker.execute` → Audit. **Nie still.** Schwere/unsupported (die Claude-CLI selbst) → geführter Schritt + Link statt Auto-Install. Verifiziert mit Dry/Echo-Kommando.

## Phase 2a — Nativer Claude-Code-Adapter (Option 1, direkt)
- [x] `ClaudeCodeProvider`: spawnt `claude -p --output-format=stream-json --input-format=stream-json --verbose`; übersetzt Claude-Code-Stream-JSON-Events (assistant-Deltas, `tool_use`, `tool_result`, `result`) ↔ unser `SessionEvent`-Contract; **jeder Tool-Zugriff durch den Broker** (Permission-Gate). Nutzt den **bestehenden Claude-Login** (kein roher Key). Verifiziert gegen recorded Stream-JSON-Fixture (deterministisch); echter `claude`-Run = User-approved. Sealed subprocess + client-taint gelten.

## Phase 2b — ACP-Weg über claude-code-acp (Option 2, Bridge)
- [x] Real-ACP-Adapter so konfigurieren, dass er die Bridge spawnt (`CAPISCO_ACP_CLI`=bridge-bin oder `npx @zed-industries/claude-code-acp`); nutzt den bestehenden Claude-Login (kein roher Key). Init-Handshake gegen einen Fake-Bridge-Stub verifiziert; echter Run User-approved. Beide Backends (2a/2b) sind in den AgentSettings wählbar.

## Phase 3 — AgentSettings-UI
- [x] AgentSettings-Popover listet Backends (installed/missing/ready) + Install-/Use-Button; minimal-friction Setup-Flow; gewähltes Backend persistiert.

## Council/Review-Notizen
- Install = konsequente Aktion aus potenziell untrusted Kontext → immer Human-Gate + Audit, nie auto (Lethal-Trifecta).
- „interface + fake, real swap = user-gated": Detection/Install-Logik + ACP-Wiring autonom verifiziert (gegen Fake-Bridge/Dry-Install); echter Install + Live-Agent sind der User-Go.
