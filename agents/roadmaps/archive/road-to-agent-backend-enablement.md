---
status: ready
block: Agent / Runtime
depends_on: [road-to-composer-context-runtime, road-to-session-store-and-acp, road-to-capability-broker]
autonomy: "A (Backend-Selektion + Verdrahtung/Tests) / C (echte Live-Antwort-Abnahme = Sicht/Verhaltens-Abnahme, braucht Backend-Config)"
council: "anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-24, 2 Runden — Konvergenz unten verankert"
---

# Road to Agent-Backend-Enablement — vom Stub zum echten Chat-Agenten

**Goal:** Der Composer-Chat soll **echte** Agent-Antworten streamen (nativer
`claude`-Login), statt des deterministischen Stubs — über die **bereits gebaute**
sichere Maschinerie (Broker-Chokepoint, fail-closed Human-Permission-Gate,
Secret-Vault). Zwei Lücken: Backend-**Selektion** (Default ist der Stub) und die
**Composer-Send → Live-Run → Transcript-Stream**-Verdrahtung.

> **Council-Konvergenz (claude-sonnet-4-5 + gpt-4o, 2026-06-24, 2 Runden):** Beide
> priorisieren das Agent-Backend als nächsten Teil (höchster Demo-/Differenzierungswert
> einer agent-orientierten IDE). Auflagen beider Mitglieder, hier eingearbeitet:
> (1) der **Seam-Vertrag** muss explizit sein (Transport, Fehlerpropagation, Grund der
> Indirektion), (2) **Trust-Boundaries** der Dev-WS-Bridge, (3) **Broker-Scope** (der
> Agent ist ein neuer Execution-Pfad), (4) **Rollback/Kill-Switch**. Use-vs-Demo-Ziel
> muss explizit sein → hier: **demobare echte Antwort** ist das Ziel.

## Phase 0 — Threat-Pass + Seam-Vertrag (blockiert alle übrigen Phasen)

> `security-sensitive-stop`: Live-Agent/Secrets/Broker/Egress → Threat-Pass vor Code.
> Diese Phase ist der Vertrag; Phase 1–3 (Code) starten erst nach Deiner Abnahme.

### Seam (was ist der „Agent" konkret)
- **Zwei Transporte hinter einer Oberfläche** (`AgentProvider`/Session):
  - `acp` — ACP-stdio (`stub-acp-agent.mjs` Default; Zed `claude-code-acp`-Bridge = realer Swap).
  - `native` — `ClaudeCodeProvider` fährt `claude -p --output-format=stream-json` mit
    Deinem **bestehenden `claude`-Login** (kein Raw-Key). `claude-stream-exec.ts` +
    `stream-json-parse.ts`.
- **Fehlerpropagation:** CLI-Crash/Auth-Fehler → die EINE Session endet mit `error`
  (kein globaler Absturz); `useLivePermission`/Transcript zeigen den Fehler ehrlich.
- **Grund der Indirektion:** Transport-Swap (Stub ↔ ACP ↔ native) ohne UI-/Sicherheits-
  Änderung; die deterministische Stub-Schiene bleibt Default für Tests/Goldens.

### Trust-Boundaries
- Die Dev-WS-Bridge bindet **nur `127.0.0.1`**, ist `import.meta.env.DEV`-gated und
  wird in den Prod-Build **nie** gebündelt. Loopback-only, keine Auth (dev-only).
- Der Agent-Subprozess hat **keinen** Execution-Pfad außer durch den Broker.

### Broker-Scope + Kill-Switch
- Jeder Agent-Seiteneffekt (file-write, shell, network, db, external-write) läuft durch
  `broker.authorize → execute`; Agent-Output ist **untrusted** (`fromUntrusted`), Egress
  ist hart human-gated (lethal trifecta).
- **Fail-closed:** Default-Resolver = deny-all; ein `ask` parkt im
  `PendingPermissionRegistry` und wartet auf die UI-Entscheidung (`getPendingPermission`/
  `resolvePermission`).
- **Kill-Switch:** (1) Deny-all-Default, (2) UI-Permission-Gate, (3) Per-Session-Cancel
  (`store.cancelRun` + Stream-Abort via Unsubscribe), (4) Prozess-Teardown bei Bridge-Stop.

### Secrets
- Optionaler `CAPISCO_ACP_API_KEY` → Secret-Vault, Injektion nur am Execution-Layer,
  **nie** an den Subprozess/Browser. Native `claude` nutzt den Login → kein Key im Spiel.

### Abuse-Case → Pflicht-Test
| Abuse-Case | Gegenmaßnahme | Test |
|---|---|---|
| Agent feuert Shell/Egress ohne Freigabe | Broker `ask` + deny-all-Default + UI-Gate | Live-Permission-Park/Resolve-Assert |
| CLI-Crash reißt die App mit | Fehler bleibt auf die Session begrenzt (`error`) | Crash-Isolations-Assert |
| Stub-Schiene driftet (Goldens/Tests brechen) | `acp`-Stub bleibt Default, native opt-in | Stub-Default-Unverändert-Assert |
| Secret landet im Subprozess/Transcript | Vault + Execution-Layer-Injektion | Secret-nie-als-Wert-Assert |

- [x] 1-seitiger Threat-Pass + Seam-Vertrag (diese Phase).
      <!-- grounded in sidecar/acp/{acp-session,claude-code-provider,real-acp-config,live-agent-provider}.ts + register-session.ts -->
- [ ] Contract reviewed (Klasse-C, Matze); erst danach starten Phase 1–3 (Code).

## Phase 1 — Native-Backend selektierbar (Default bleibt Stub)
- [x] Dev-Bridge liest `CAPISCO_AGENT_BACKEND=native` (sonst `acp`-Stub) und reicht
      `backend` in den Live-Agent-Pfad; native nutzt den `claude`-Login.
      <!-- sidecar/main.ts: registerSession(..., { pending, backend }) mit
           backend = env.CAPISCO_AGENT_BACKEND==="native" ? "native" : undefined (→ Default acp). -->
- [x] Unit-Assert: Default unverändert (Stub, byte-identische Goldens); `native` wählt
      `ClaudeCodeProvider`; bestehende native-Provider-Tests grün.
      <!-- typecheck clean; native-backend-select + todo-agent + acp-transport (15) grün;
           Env unset → backend undefined → registerSession-Default "acp". -->

## Phase 2 — Composer-Send → Live-Run → Transcript-Stream

> **Grounding-Befund (2026-06-24):** `AcpSession.start(prompt)` war one-shot —
> es legt IMMER eine neue Store-Session an (für ToDo→Agent), und der **Token-Stream
> (die eigentliche Agent-Antwort) wird NICHT persistiert** (nur tool/permission/
> status; siehe `#applyEvent`). Interaktiver Chat braucht daher drei additive Teile:
> (a) Bestehende-Session-Support, (b) Token→Message-Assemblierung, (c) User-Block-Append.

- [x] **(a) `AcpSession.existingSessionId`** — Turn läuft in die bestehende Session
      (skip create, mark running, Stream appendet dorthin); Default (ToDo) unverändert.
      <!-- acp-session.ts opt+field+start-Branch; acp-transport.test.ts: 9 Tests grün
           (neuer Existing-Session-Test: returned===existing.id, list()===1, status done,
           tool-Block appended; Create-Pfad byte-identisch). -->
- [x] **(b) Token→Message-Assemblierung** — `token`-Deltas pro messageId gepuffert, bei
      `done` als Agent-`message`-Block appended (`#tokenBuf` + `#flushAgentMessage`).
      <!-- Sub-Agent A: acp-session.ts additiv; acp-transport.test.ts assert body==Deltas. -->
- [x] **(c) Provider `sendPrompt(sessionId, text)`** (`AgentProvider` + IPC-Proxy +
      live-agent-provider + Mock-noop): User-Block appenden → broker-gated `AcpSession(
      existingSessionId)` treiben (ACP-Pfad: Stub default, echter claude via `CAPISCO_ACP_CLI`-
      Bridge); Stream via neuem `pending.publish` an Subscriber; Permission → `pending.resolver`.
      <!-- c-live (ich): live-agent-provider.sendPrompt + pending.publish + main.ts(broker,acp);
           Native-ClaudeCodeProvider-Chat-Adapter = Follow-up. -->
- [x] **(d) UI:** Composer-`send` → `getProviders().agent.sendPrompt(cur.id, text)` (bridge-gated);
      Transcript rendert Live-Blocks via `getBlocks`+`subscribe` NUR mit Bridge — No-Bridge-Mock-
      Pfad byte-identisch (Goldens unverändert).
      <!-- Sub-Agent B: AgentWorkspace.send + Transcript useLiveBlocks + Composer.send.test.tsx. -->
- [x] Asserts (schlüssel-frei gegen den Stub): existing-session-Run appendet Message+Tool in
      die bestehende Session (acp-transport.test); UI-`send` ruft `sendPrompt` (Composer.send.test);
      Broker-Gate-Tests unberührt. **608 Unit-Tests grün, typecheck/lint/build/24 Visual grün.**

## Phase 3 — Verifikation
- [x] Schlüssel-frei: gegen den deterministischen Stub-Agenten bewiesen, dass der
      Live-Loop streamt (existing-session-Run + Token→Message) + das Permission-Gate
      greift (Broker-Gate-Tests grün) + die UI `sendPrompt` ruft + Live-Blocks rendert.
- [ ] Klasse-C (Matze): **echte** `claude`-Antwort im Chat (braucht Deinen Login) —
      1-Zeilen-Setup `CAPISCO_ACP_CLI=<claude-code-acp> pnpm dev` (ACP-Bridge).

## Akzeptanz
- Stub bleibt Default → Mock/Visual-Harness byte-identisch.
- Jeder Agent-Seiteneffekt broker-gated + human-gated; fail-closed.
- Echte Antwort demobar mit einem Env-Flag, ohne Raw-Key.
