---
status: ready
block: Token-Ökonomie
depends_on: [road-to-session-store-and-acp, road-to-agent-provisioning, road-to-design-sync-v1]
autonomy: "A (Verdrahtung/Injektion/Degrade) / B (RTK-Binary-Swap) / C (Terse-Verhalten + Kompressions-Nutzen = Sicht/Verhaltens-Abnahme)"
council: "3 Linsen 2026-06-21 (Architektur · Autonomie · Security) — Befunde unten verankert"
---

# Road to Token-Ökonomie — Telemetrie-Ampel, Handoff, RTK, Caveman, Modell-Routing

**Goal:** Token so gut wie möglich sparen, ohne die Grounding-These zu verraten. Drei Teile
(Konzept §5.10) **plus Modell-Routing** (F5): (1) Telemetrie-Ampel + **komprimierter**
Session-Handoff, (2) RTK als optionaler Observation-Compressor **nur** im LLM-Pfad und **nur**
für den unstrukturierten Long-Tail, (3) Caveman als nativer, default-an/opt-out Terse-Modus mit
der **harten Grenze „formt Erklärung, nie Fakten/Safety"**, (4) **Modell-Routing** nach
**Herkunft/Rolle (deterministisch), nicht Inhalt**, klein-zuerst mit Quality-getriebener
Eskalation, **Sperrliste** (Broker/Review/untrusted nie heruntergestuft) als Invariante,
sichtbare Modell-Badge + Per-Session-Override, **default aus**.

> Referenz: `agents/tmp/token-economy-decisions.md` (DECISIONS-Idiom, zum Einpasten),
> `agents/tmp/feature-token-saving.txt` (Begründung), Konzept §5.10.

> **Council-Befund (Architektur):** Das visuelle Meter + Schwellwert-Popover gehört in
> **design-sync-v1** (Projektion). Diese Roadmap baut die **Mechanik dahinter**. Der eigentlich
> load-bearing neue Block ist **Memory-Kompression (P0)** — nicht das Meter. Caveman-Injektion
> muss **beide** Agent-Backends treffen (native stream-json **und** ACP) — sonst ist Terse nur
> bei einem Backend an.

## Akzeptanz

- **Drei harte Pflicht-Tests** (Council — ohne sie rottet die Sicherheit still):
  1. **Caveman-Negativ-Assert:** Diagnostics, Broker-Permission-Prompts, Secret-Referenzen,
     Audit-Log, Commit-Messages tragen den Caveman-Regelsatz **nie** — unabhängig vom Toggle.
     Strukturell: diese Flächen durchlaufen einen Pfad, den der Terse-Injektor **gar nicht
     erreicht** (Invariante, kein abschaltbarer Default).
  2. **RTK-Degrade-Assert** (`PATH` ohne `rtk` → roher Output, kein Hard-Fail) **+**
     **RTK-nie-im-autoritativen-Pfad-Assert** (Broker/Quality/Git/Audit konsumieren nie
     RTK-Output).
  3. **Handoff-Assert:** Neue Session startet mit Auszug der alten (Session-Store `copy`/
     `resume`); `retryAsBranch`/`copy` überschreiben den Parent nie (B3-Tamper-Disziplin).
- **Vier explizite menschliche Abnahmen** (Klasse C, „Test grün" ≠ „abgenommen"):
  Caveman-Ton + Einmal-Hinweis-UX · Memory-Kompressions-*Nutzen* · RTK-reale-Ersparnis
  (Benchmark-Skepsis: 65–90 % als Richtung, nicht Zusage) · —.
- Determinismus: Ampel asserted die **Klasse** (grün/orange/rot), nie den maskierten Token-String;
  Caveman-*Output* wird **nicht** golden-getestet (LLM-Verhalten), nur die Injektion;
  RTK-Parser golden gegen **eingefrorene** Long-Tail-Fixtures bei gepinnter RTK-Version.

## Decision-Gates (PO — Agent kann nicht allein entscheiden)

| Gate | Default-Vorschlag | Quelle |
|---|---|---|
| Ampel-Schwellwerte | **%-vom-Modell-Context** (modellunabhängig), nicht absolute Token | token-economy-decisions §Offene |
| RTK harte Dependency vs. Angebot | **Angebot** (Install-Prompt beim ersten Long-Tail-Kommando), kein Bundling | token-economy-decisions §Offene |
| Caveman Grenz-Flächen-Liste | **entschieden** (Diagnostics/Broker/Secret/Audit/Commit); Erweiterung = Security-Entscheidung, nie autonom | Security-Linse AK-T3 |

## Phase 0 — Memory-Kompression (das neue Primitiv)

- [x] **caveman-compress-Äquivalent**: komprimiert getragenen Kontext / Handoff-Zusammenfassungen.
      **Code / URLs / Pfade byte-erhalten** (wie caveman-compress) — als A-Invariante testbar.
      <!-- `src/lib/compress/memory-compress.ts` + `handoff-summary.ts`; A-Invariante grün (`memory-compress.test.ts`) -->
- [x] Vendored Regelsatz (MIT, Attribution); Test: byte-Erhaltung der schützenswerten Tokens.
      <!-- `src/lib/compress/caveman-ruleset.ts` (SPDX MIT, Attribution-Block); byte-Erhaltung getestet -->
- [ ] *Nutzen* der Zusammenfassung = menschliche Abnahme (Klasse C).

## Phase 1 — Rot→neue-Session-Handoff (verdrahtet das Meter)

- [x] Verdrahtet das **Rot-Banner** (aus design-sync-v1 P4, dort No-op) mit Session-Store
      `copy`/`resume` + P0-Kompression: **[New session]** startet eine frische Session **mit
      komprimierter Zusammenfassung der alten** (besser als Claude Codes leerer Neustart).
      <!-- `src/shell/agents/handoff.ts` (buildSessionHandoff) + store `handoffToNewSession`; Banner-Button `context-banner-new` → `startHandoff`; Seed gerendert via `HandoffSeed` (testid `handoff-seed`) -->
- [x] Kein Auto-Switch — Mensch entscheidet. Handoff-Assert (s. Akzeptanz).
      <!-- Handoff nur per Button (nie auto); `handoff.test.ts`: Seed = Extrakt, Parent nie mutiert (B3-Tamper), deterministisch -->

## Phase 2 — Caveman Terse-Modus (beide Backends)

- [x] Regelsatz vendored, **nativ in den ACP-System-Kontext injiziert** (kein installierter
      Skill) — und **ebenso in den nativen stream-json-System-Kontext** (B8). Treffer auf
      **beide** `registerSession({backend})`-Pfade.
      <!-- `sidecar/acp/caveman-terse.ts` (SPDX MIT vendored); injiziert in `acp-session.ts` (session/prompt) UND `claude-code-provider.ts` (sendUserPrompt); `terse` durch beide Starter + `registerSession` gefädelt; `caveman-terse.test.ts` beweist beide Backends -->
- [x] **Default an, opt-out pro Session**; Level (lite/full/ultra) in der Composer-Control-Bar
      **neben „reasoning effort"**; sichtbarer Toggle + **einmaliger Hinweis** beim ersten terse
      Output („gewollt, nicht kaputt/unhöflich").
      <!-- `ComposerBar` TerseControl (`composer-terse`, neben EffortControl); Store `terseEnabled/terseLevel/terseHintSeen` (persistiert); Einmal-Hinweis `terse-hint` beim ersten Send; AgentWorkspace.test.tsx grün -->
- [x] **Invariante (AK-T3):** Terse formt nur die *Erklärung*. Grenz-Flächen umgehen ihn
      **strukturell**. **Caveman-Negativ-Assert** (Pflicht-Test 1).
      <!-- Injektor ist reine Funktion über den AGENT-PROMPT; Broker/Audit/Quality/Secret-Pfade rufen ihn nie auf → strukturell. `caveman-terse.test.ts`: Audit-Records tragen den Marker nie (beide Backends) -->
- [x] Positiv-Assert: bei default-an enthält der gesendete System-Kontext den Regelsatz-Marker;
      opt-out entfernt ihn (Assert gegen den gesendeten Prompt-String, kein LLM-Roundtrip).
      <!-- `sentSystemContext`-Getter auf AcpSession + ClaudeCodeProvider; Assert gegen den String, kein LLM-Roundtrip -->
- [ ] Terser *Output* + Einmal-Hinweis = Sicht/Verhaltens-Abnahme (Klasse C).

## Phase 3 — RTK Observation-Compressor (extern, optional)

- [x] **Externes Rust-Binary**: install/anbieten (brew/cargo/curl), Sidecar **`execFile`** (kein
      Shell, argv-Array — B1-Git-Disziplin). RTK ist eine broker-relevante Capability (untrusted
      external binary im Datenpfad), keine freie Ausnahme (AK-T5).
      <!-- `sidecar/rtk/rtk-exec.ts` (execFile, raw→stdin, compressed→stdout); im broker-chokepoint-Test als auditiertes `process`-Primitiv gelistet. Realer Binary-Install = User-broker-approved (deferred); Fixture-Filter `rtk-fixture-filter.mjs` exerziert den Spawn-Pfad -->
- [x] **Nur LLM-Observation-Pfad, nur unstrukturierter Long-Tail** (`ls`/`find`/`docker ps`/
      beliebiges CLI ohne nativen Parser). git (B1) + quality (B5) bleiben **autoritativ**;
      RTK ersetzt sie nie.
      <!-- `rtk-compressor.ts` `ObservationSource`: nur `*-longtail` erlaubt; `authoritative` wird outright refused (throw) -->
- [x] **Trust-Grenze (AK-T1/T2):** RTK nie auf Audit / Diagnostics / Broker / typisierte
      Git-/Quality-Ausgaben / Secret-Refs. RTK-Output trägt ein Typ-Tag (`RtkFiltered` /
      `LlmFacingOnly`), das `broker.authorize` / `audit.record` **nicht** akzeptieren →
      Einbahn-Datenfluss strukturell. **RTK-nie-im-autoritativen-Pfad-Assert** (Pflicht-Test 2).
      <!-- `contracts/rtk.ts`: `LlmFacingOnly` gebrandeter String (phantom brand → nicht zu `string` zuweisbar, Compiler-Gate) + Laufzeit-Marker; `capability-broker.ts` authorize + `audit-store.ts` record refusen den Marker. `rtk-observation.test.ts` beweist beide Refusals -->
- [x] **Sauberer Degrade:** fehlt RTK → roher Output durchgereicht, kein Hard-Fail; Degrade-Pfad
      schickt **keine** Grenzfläche durch RTK-Ersatzlogik. **RTK-Degrade-Assert** (Pflicht-Test 2).
      <!-- `rtkCompress` gibt `undefined` bei fehlendem Binary (nie throw); `compressObservation` reicht roh durch (branded, `compressed:false`). Degrade-Pfad sieht nur Long-Tail (authoritative refused) -->
- [x] Parser-Test golden gegen recorded Long-Tail-Fixtures (gepinnte RTK-Version).
      <!-- `rtk-parse.ts` pure `parseLongTail`; golden gegen `fixtures/ls-longtail.{raw,expected}.txt`; idempotent + end-to-end-Spawn durch den Fixture-Filter ergibt denselben Output -->

## Phase 4 — Modell-Routing (F5, `feature-model-switch.txt`)

> **Council-Lock:** Route nach **Herkunft/Rolle (deterministisch)**, nie nach Inhalt — ein
> Inhalts-Classifier ist nicht-deterministisch und bräuchte fast das große Modell, um die
> Modellwahl zu treffen. Die **Asymmetrie** ist das Risiko: unterschätztes Haiku liefert
> „fast richtig" = der Marktschmerz. Darum klein-zuerst **mit** Quality-Eskalation, eine
> nie-heruntergestufte Sperrliste, und **default aus** (greift non-deterministisch ins
> Ergebnis → erst an realen Roadmap-Läufen kalibrieren).

- [x] **on/off, DEFAULT AUS.** Routing-Toggle in der Composer-Control-Bar; Store
      `routingEnabled` (persistiert), Default `false`.
      <!-- `store.ts` routingEnabled=false default; `ComposerBar` RoutingControl (`composer-routing`, `composer-routing-toggle`); AgentWorkspace.test.tsx: Toggle default OFF -->
- [x] **Routing nach Herkunft/Rolle, nie Inhalt** — reine deterministische Funktion (unit-testbar):
      `routeOrigin(origin)` mappt Subagent-Typ / Roadmap-Schritt-Kategorie / ToDo → Tier
      (small/mid/large). Mechanisch → small, analysis → mid, free-conversation/architecture
      **nicht geroutet** (Default large; höchstes Fehlklassifikations-Risiko).
      <!-- `contracts/model-routing.ts` (`SessionOrigin`/`ModelTier`/`RoutingDecision`); `lib/model-routing/router.ts` `routeOrigin` pure; `router.test.ts` exhaustiv (16 Tests) -->
- [x] **Klein-zuerst mit QUALITY-getriebener Eskalation** (B5 rot → größeres Modell, Fehler als
      Kontext). `escalateOnQuality(decision, qualityFailed)` stuft genau eine Stufe hoch
      (gecappt bei large), nie ein vager Confidence-Score — das geerdete B5-Urteil ist das Signal.
      <!-- `router.ts` `escalate`/`escalateOnQuality`; small→mid→large, no-op bei pass + an der Decke; `router.test.ts` beweist die Eskalation + dass sie nie downgradet -->
- [x] **SPERRLISTEN-Invariante** — Broker/Permission-Entscheidungen, AI-Review selbst, und
      untrusted-egress werden **nie heruntergestuft** (immer large). Invariante, kein Default
      (gleicher Geist wie Prod-Read-only). Ein `reviewer`-Subagent ist ebenso geschützt.
      <!-- `isBlocklisted`: broker-decision/ai-review/untrusted-egress/reviewer-subagent → large, `blocklisted:true`; Eskalation behält das Flag; `router.test.ts` deckt jede Sperrlisten-Herkunft ab -->
- [x] **Sichtbare Modell-Badge pro Session-Tree-Knoten + Per-Session-Mensch-Override.**
      Override gewinnt immer; „Auto" löscht ihn. Badge zeigt das effektive Modell.
      <!-- `SessionTabbar` ModelBadge → `effectiveModel(session, modelOverrides)`; `ComposerBar` Override-Picker (`composer-routing-override-*`); Store `modelOverrides` (persistiert) + `setModelOverride`; AgentWorkspace.test.tsx: Override gewinnt + Badge spiegelt es; agents/chat-Goldens neu generiert (neue Composer-Control) -->
- [ ] *Ersparnis-Kalibrierung* an realen Roadmap-Läufen = menschliche Abnahme (Klasse C).
