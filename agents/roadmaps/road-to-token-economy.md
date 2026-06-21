---
status: ready
block: Token-Ökonomie
depends_on: [road-to-session-store-and-acp, road-to-agent-provisioning, road-to-design-sync-v1]
autonomy: "A (Verdrahtung/Injektion/Degrade) / B (RTK-Binary-Swap) / C (Terse-Verhalten + Kompressions-Nutzen = Sicht/Verhaltens-Abnahme)"
council: "3 Linsen 2026-06-21 (Architektur · Autonomie · Security) — Befunde unten verankert"
---

# Road to Token-Ökonomie — Telemetrie-Ampel, Handoff, RTK, Caveman

**Goal:** Token so gut wie möglich sparen, ohne die Grounding-These zu verraten. Drei Teile
(Konzept §5.10): (1) Telemetrie-Ampel + **komprimierter** Session-Handoff, (2) RTK als
optionaler Observation-Compressor **nur** im LLM-Pfad und **nur** für den unstrukturierten
Long-Tail, (3) Caveman als nativer, default-an/opt-out Terse-Modus mit der **harten Grenze
„formt Erklärung, nie Fakten/Safety"**.

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

- [ ] **caveman-compress-Äquivalent**: komprimiert getragenen Kontext / Handoff-Zusammenfassungen.
      **Code / URLs / Pfade byte-erhalten** (wie caveman-compress) — als A-Invariante testbar.
- [ ] Vendored Regelsatz (MIT, Attribution); Test: byte-Erhaltung der schützenswerten Tokens.
- [ ] *Nutzen* der Zusammenfassung = menschliche Abnahme (Klasse C).

## Phase 1 — Rot→neue-Session-Handoff (verdrahtet das Meter)

- [ ] Verdrahtet das **Rot-Banner** (aus design-sync-v1 P4, dort No-op) mit Session-Store
      `copy`/`resume` + P0-Kompression: **[New session]** startet eine frische Session **mit
      komprimierter Zusammenfassung der alten** (besser als Claude Codes leerer Neustart).
- [ ] Kein Auto-Switch — Mensch entscheidet. Handoff-Assert (s. Akzeptanz).

## Phase 2 — Caveman Terse-Modus (beide Backends)

- [ ] Regelsatz vendored, **nativ in den ACP-System-Kontext injiziert** (kein installierter
      Skill) — und **ebenso in den nativen stream-json-System-Kontext** (B8). Treffer auf
      **beide** `registerSession({backend})`-Pfade.
- [ ] **Default an, opt-out pro Session**; Level (lite/full/ultra) in der Composer-Control-Bar
      **neben „reasoning effort"**; sichtbarer Toggle + **einmaliger Hinweis** beim ersten terse
      Output („gewollt, nicht kaputt/unhöflich").
- [ ] **Invariante (AK-T3):** Terse formt nur die *Erklärung*. Grenz-Flächen umgehen ihn
      **strukturell**. **Caveman-Negativ-Assert** (Pflicht-Test 1).
- [ ] Positiv-Assert: bei default-an enthält der gesendete System-Kontext den Regelsatz-Marker;
      opt-out entfernt ihn (Assert gegen den gesendeten Prompt-String, kein LLM-Roundtrip).
- [ ] Terser *Output* + Einmal-Hinweis = Sicht/Verhaltens-Abnahme (Klasse C).

## Phase 3 — RTK Observation-Compressor (extern, optional)

- [ ] **Externes Rust-Binary**: install/anbieten (brew/cargo/curl), Sidecar **`execFile`** (kein
      Shell, argv-Array — B1-Git-Disziplin). RTK ist eine broker-relevante Capability (untrusted
      external binary im Datenpfad), keine freie Ausnahme (AK-T5).
- [ ] **Nur LLM-Observation-Pfad, nur unstrukturierter Long-Tail** (`ls`/`find`/`docker ps`/
      beliebiges CLI ohne nativen Parser). git (B1) + quality (B5) bleiben **autoritativ**;
      RTK ersetzt sie nie.
- [ ] **Trust-Grenze (AK-T1/T2):** RTK nie auf Audit / Diagnostics / Broker / typisierte
      Git-/Quality-Ausgaben / Secret-Refs. RTK-Output trägt ein Typ-Tag (`RtkFiltered` /
      `LlmFacingOnly`), das `broker.authorize` / `audit.record` **nicht** akzeptieren →
      Einbahn-Datenfluss strukturell. **RTK-nie-im-autoritativen-Pfad-Assert** (Pflicht-Test 2).
- [ ] **Sauberer Degrade:** fehlt RTK → roher Output durchgereicht, kein Hard-Fail; Degrade-Pfad
      schickt **keine** Grenzfläche durch RTK-Ersatzlogik. **RTK-Degrade-Assert** (Pflicht-Test 2).
- [ ] Parser-Test golden gegen recorded Long-Tail-Fixtures (gepinnte RTK-Version).
