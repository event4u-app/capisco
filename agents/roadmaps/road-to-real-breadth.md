---
status: ready
block: Actually Works / Breadth
depends_on: [road-to-actually-works, road-to-real-runtime]
autonomy: "B (Provider-Anbindung, braucht API-Tokens/DB-Zugänge) / C (Browser-Threat-Model + Real-Abnahme + Prod-Confirm = Matze)"
---

# Road to Real Breadth — die Breite (Tickets · Datasource · Secrets · Token · Observability · Browser)

*W-Serie, Roadmap 3 von 3. Geteilte Doktrin, Invarianten, Verifikation, Council-
Konvergenz: siehe [`00-actually-works-overview.md`](00-actually-works-overview.md).
Setzt [`road-to-actually-works`](road-to-actually-works.md) und
[`road-to-real-runtime`](road-to-real-runtime.md) voraus. Akzeptanz = manuelle
Real-Abnahme + Conformance/Invarianten-Tests, NICHT „Test grün".*

**Goal:** Die restlichen Provider von Fakes auf echt — die volle Werkzeug-Breite,
die das Konzept versprochen hat: echte Tickets→Worktree→Review-Schleife, echte
DBs (Prod strukturell read-only), Secrets die Neustarts überleben, Token-Ökonomie
live, Observability auf einer Schiene, und ein gemanagter Browser — letzterer als
**eigene security-scoped Phase**, weil er der schlimmste Lethal-Trifecta-Hotspot ist.

---

## Phasen-Reihenfolge

| # | Phase | Was es real macht | Braucht Dich |
|---|---|---|---|
| P0 | Tickets + Forge real (+ Keychain-Primitive) | Ticket→Worktree→Status; PR-Board live | API-Tokens |
| P1 | Datasource real | Queries, Schema-Autocomplete, Prod read-only, Fan-out | DB-Zugänge |
| P2 | Token-Ökonomie live | RTK, Caveman-Kalibrierung, Routing-Ersparnis | RTK-Binary |
| P3 | Observability-Provider | Sentry/Datadog via MCP, Signal-Schiene | MCP/Tokens |
| P4 | Gemanagter Browser (**security-scoped**) | Preview, Playwright, Agent-Login via Broker | MCP/Tokens |

**Graph:** P0 (Keychain-Primitive landet hier — erster echter persistierter
Credential-Konsument) → P1 (zweiter Konsument) → P2 → P3 → **P4 isoliert** (eigener
Threat-Model, höchstes Risiko, zuletzt).

---

## Provider-Auth (Multi-Mode) — gilt für ALLE externen Provider

**Entscheidung (2026-06-26, Matze):** Jeder externe Provider (GitHub, GitLab, Jira,
Linear, Sentry, Observability, …) unterstützt **mehrere Auth-/Transport-Modi**, und
wir nutzen, was immer verfügbar ist — in dieser Präferenz:

1. **MCP** — wenn ein MCP-Server für den Dienst verbunden ist (reichste, auth-delegierte Integration).
2. **Web-OAuth** — interaktiver Login (Browser-Flow), Token via Refresh erneuert.
3. **API-Token** — aus der OS-Keychain (P0), Basic/Bearer, **secret-by-reference** (Wert nur im Execution-Layer, nie im LLM-Context).
4. **Lokales CLI** als Sonderform von „Web-Auth via Tool-Session" (z. B. `gh` für GitHub — schon genutzt).

**Umsetzung:** eine gemeinsame `ProviderAuth`-Abstraktion (`mode: "mcp" | "oauth" |
"token" | "cli"`) + ein Resolver, der pro Provider den besten verfügbaren Modus
wählt. Provider-Code spricht gegen `ProviderAuth`, nicht gegen einen festen Modus —
so kommt OAuth/MCP später ohne Umbau dazu. Sekret-Speicherung immer Keychain (P0),
Egress immer GET-only-read bzw. broker-gegated bei Schreib/Write-back.

> Day-one: GitHub-Forge nutzt `cli` (`gh`-Login). Jira startet mit `token`
> (Keychain), `oauth`/`mcp` als nächste Modi hinter derselben `ProviderAuth`.

---

## Phase 0 — Tickets + Forge real (Jira · Linear · GitHub) + Keychain-Primitive

**Goal:** Die Ticket→Worktree→Review→Status-Schleife **lebt**; PR-Board „wessen
Zug". Ersetzt `FixtureTaskProvider` (aufgenommene JSON). **Hier landet die
OS-Keychain-Primitive (Council #+):** erster echter persistierter Credential — der
Agent-Pfad braucht sie nicht (`claude`-CLI managt eigene Auth), Ticket-/Egress-
Tokens schon.

- [x] **OS-Keychain real (Primitive):** `InMemorySecretStore` → macOS `security` /
      Windows DPAPI / Linux libsecret. Secrets überleben Neustart, **nie im
      LLM-Context**, nie ins Subprozess-env. (Wird von P1-Datasource mitgenutzt.) <!-- KeychainSecretStore (cache+write-through, 1 service `capisco`, -U idempotent, kein Garbage) + FileSecretStore (0600 fallback) + createSecretStore-Factory; in dev-bridge + unix-sidecar verdrahtet; gegen echte Keychain getestet; scripts/secret.mjs (stdin, kein argv-leak). Windows DPAPI/libsecret = Datei-Fallback bis nativ -->
- [x] **Task-Provider real** (Jira/Linear via MCP/API-Token, aus dem Keychain):
      „meine Tickets", „nächstes aus dem Sprint ziehen". <!-- RealTaskProvider (Jira, token-Modus via ProviderAuth, Token-by-reference aus Keychain); listTickets/myTickets/nextFromSprint über JQL; gegen echtes galawork-Jira getestet; dev-bridge Fixture→Real-Swap (env|store). Linear + OAuth/MCP-Modi offen -->
- [ ] **Ticket-Lifecycle live:** Ticket ziehen → Worktree+Runtime (`real-runtime`-P0)
      → Status „In Progress"; fertig → Review → Status.
- [x] **Forge-Provider real** (GitHub/GitLab): PR-Board, **„wessen Zug?"**-Filter,
      **Overdue 7 Tage konfigurierbar**, Stale-Alert. <!-- RealForgeProvider via gh-exec (gh-Login, kein Token); whoseTurn/stale (default 7d), gegen echtes Repo getestet; dev-bridge Fixture→Real-Swap. GitLab offen -->
- [ ] **Awareness:** wer arbeitet wo, Branch-Überlappung, Konflikt-Vorhersage.
- [ ] **Bidirektionaler Status-Sync** (eine Richtung zuerst; Webhooks/Rate-Limits).
- [ ] **Lethal-Trifecta-Gate:** Ticket-Text ist untrusted Input — jeder Egress/Write
      daraus geht durch den harten Human-Gate (nie auto-gefeuert).

**Stolpersteine:** API-Tokens (Du); Webhook-Setup; Rate-Limits; Jira-vs-Linear-
Status-Semantik; Forge-Heterogenität; Keychain-Plattform-APIs.

**Akzeptanz (real):** Du ziehst ein echtes Jira-Ticket, ein Worktree entsteht, der
**echte** Status springt auf „In Progress"; im PR-Board siehst Du echte PRs, die auf
Dich warten; ein Token überlebt einen App-Neustart.

---

## Phase 1 — Datasource real (Redis · MySQL · Postgres · Tenant-Fan-out)

**Goal:** DataGrip-artige Realität — Queries, Schema-Autocomplete, **Prod read-only
als Invariante**, Tenant-Fan-out. Nutzt die P0-Keychain.

> **Erwartung setzen (Council-Gegenlesen):** Dies ist **der unterschätzte Brocken** —
> DataGrip-Funktionalität ist ein eigenes Produkt. Diese Phase wird beim Eintauchen
> realistisch **selbst in Unterphasen zerfallen** (Connections → Query-Runner →
> Schema-Introspektion → Diff/Sync → Fan-out); jetzt nicht aufteilen, aber nicht als
> „eine Phase neben Tickets" missverstehen. **Die zentrale Architekturentscheidung
> der Phase ist „einbinden statt nachbauen"** (bestehenden DB-Provider/Treiber-Layer
> adoptieren statt eine eigene DB-IDE zu bauen) — kein Nebensatz, sondern der erste,
> folgenschwerste Schritt. Vor allem anderen entscheiden.

> ⛔ **DESIGN-GATE G-PROD-RO (Klasse-S, Build-Stopp — Overview §6a) — gilt NUR für den
> Schreib-/Enforcement-Teil.** Lesende Connections, Query-Runner und Schema-
> Introspektion dürfen laufen. ABER: Prod-read-only-Durchsetzung, per-Befehl-Einmal-
> Escape und Tenant-Fan-out-Write sind gesperrt, bis das Enforcement-Design als
> geschriebenes Artefakt vorliegt UND einen zweiten unabhängigen Durchgang bestanden
> hat. Begründung: read-only muss **strukturell am Treiber-Layer** sitzen, nicht in
> der UI — Single-Reviewer reicht für diese Invariante nicht.

**Lesender Betrieb (läuft frei, kein Gate):**

- [ ] **Connections real** (Redis/MySQL/Postgres-Treiber; Credentials aus Keychain);
      Explorer gruppiert pro Connection.
- [ ] **Raw Queries** + **schema-bewusste Autovervollständigung** (SQL über den
      LSP-Host).
- [ ] **Struktur-/Daten-Vergleich** (prod→lokal) über den Diff-Viewer.
- [ ] **Tenant-Fan-out (nur lesend):** Query über N gleich-strukturierte DBs mit
      Aggregation.
- [ ] **Query-History** (Anzeige) — ehrliche Grenze (Kaskaden/Trigger nicht
      rückgängig) im UI benannt.

**Schreib-/Enforcement-Kern (gesperrt bis G-PROD-RO offen):**

- [ ] **GATE G-PROD-RO (blockierend für den Schreib-Pfad):** Enforcement-Design-
      Dokument liegt vor — beweist, dass `production`-Schreibzugriff **am Treiber-Layer
      strukturell unkonstruierbar** ist (nicht nur UI-Badge); spezifiziert die Form des
      per-Befehl-Einmal-Escapes (danach automatisch wieder read-only); spezifiziert das
      **adversariale Testdesign**. **Zweiter Durchgang bestanden + Matze-Freigabe.**
      Wird Acceptance-as-Runbook (Overview §4.5).
- [ ] *(gesperrt)* **Prod read-only = Invariante live:** abgeleitet aus
      `env==="production"`, **strukturell** nicht schreibbar; `READ-ONLY`-Badge +
      Lock-Glyphen. Welche DB `production` ist: **human-confirmed**, nie aus
      Connection-String inferiert.
- [ ] *(gesperrt)* **Per-Befehl-Einmal-Schreib-Escape** (danach automatisch wieder read-only).
- [ ] *(gesperrt)* **Tenant-Fan-out-Write** nur mit Per-Ausführung-Bestätigung
      (broker-gegated, nie persistiert).
- [ ] *(gesperrt)* **Schreib-Undo** (Snapshot-vor-Schreiben), Grenze im UI benannt.
- [ ] *(gesperrt)* **Adversarial-Test:** Prod-Schreibversuch muss strukturell scheitern.

**Stolpersteine:** Treiber-Management; Schema-Introspektion; **Read-only-Durchsetzung
am Treiber-Layer** (nicht nur UI); Fan-out-Performance/Teilfehler.

**Akzeptanz (real):** Du verbindest eine echte DB, tippst einen Query mit **Tabellen-/
Spalten-Autocomplete**, führst ihn aus, siehst Ergebnisse; ein Prod-Schreibversuch
ist **strukturell geblockt** außer per expliziter Einmal-Freigabe.

---

## Phase 2 — Token-Ökonomie live (RTK · Caveman · Model-Routing-Kalibrierung)

**Goal:** Die Token-Ökonomie-Mechanik (gebaut + getestet gegen Fakes) am echten
System. Council: bewusst spät — der gefühlte Wert kam früher (Agent/Editor).

- [ ] **RTK installieren/anbieten** (Apache-2.0-Binary, Shell-out, human-gated);
      **nur LLM-Observation-Pfad, nur unstrukturierter Long-Tail**; nie autoritativer/
      Audit-Pfad; Degrade wenn fehlend (`rtk-observation.test.ts` real bestätigen).
- [ ] **Caveman** in beiden echten Backends kalibrieren (Output-Qualität am echten
      Modell); Default-on/opt-out; Grenz-Flächen-Negativ-Assert am echten Lauf.
- [ ] **Model-Routing kalibrieren** an echten Roadmap-Läufen (Default off,
      Herkunfts-Routing, B5-Eskalation aus `real-runtime`-P2); **Ersparnis messen**
      (Klasse-C — oft kleiner als erhofft wegen Doppellauf).
- [ ] **Token-Ampel** mit echten Zahlen (aus `actually-works`-P3); Rot →
      **Handoff mit komprimierter Zusammenfassung** (`lib/compress/`).

**Stolpersteine:** RTK-Binary-Install-Flow (human-gated); Caveman-Output-Qualität;
Routing-Ersparnis real oft < erhofft.

**Akzeptanz (real):** Ein Long-Tail-Kommando läuft durch RTK kompakter in den
Kontext; der Agent antwortet terse; bei Rot bietet Capisco eine neue Session **mit
Zusammenfassung** an; die gemessene Ersparnis ist dokumentiert (auch wenn klein).

---

## Phase 3 — Observability-Provider (volle Fläche)

**Goal:** Über die Minimal-Spine-Observability (`actually-works`-P3) hinaus die
externen Provider + die geteilte Signal-Schiene.

- [x] **Observability-Provider** (Sentry/Datadog/New Relic via MCP); Dev-Grafana-Embed. <!-- Sentry-Issues-Kern: RealSentryProvider (Bearer via ProviderAuth, secret-by-reference), listIssues → Spec-Shape + toSignals (source observability); gegen echtes galabau-workgroup-gmbh-Sentry live verifiziert; dev-bridge registriert wenn org+token. Crons/Performance/Alerts (Spec §4.2–4.4) + Datadog/NewRelic/Grafana = Folge-Slices -->
- [ ] **IDE-Selbst-Telemetrie** strikt opt-in, gescrubbt, nie aus Tresor/Code.
- [ ] **Geteilte Signal-Fläche** live (PR/Container/Observability auf *einer* Schiene).

**Stolpersteine:** MCP-Server-Anbindung; Signal-Dedup über Quellen.

**Akzeptanz (real):** Ein echter Sentry-Fehler erscheint auf der Signal-Schiene
neben Container-Health und PR-Status.

---

## Phase 4 — Gemanagter Browser (SECURITY-SCOPED — eigener Threat-Model)

**Goal (Council #+, isoliert):** *Ein* Browser für drei Bedarfe. **Der schlimmste
Lethal-Trifecta-Hotspot im ganzen Produkt:** untrusted Web-Content × echte
Credentials × Egress, auf einem agent-getriebenen Pfad. Darum eigene Phase mit
dediziertem Threat-Model, zuletzt, nie autonom bei Egress.

> ⛔ **DESIGN-GATE G-BROWSER (Klasse-S, Build-Stopp — Overview §6a).** Diese Phase ist
> gesperrt, bis das Browser-Threat-Model als geschriebenes Artefakt vorliegt UND einen
> zweiten unabhängigen Durchgang (Multi-Modell-Council oder zweiter Matze-Durchgang)
> bestanden hat. Bis dahin: Agent baut **KEINE Zeile Browser-Code**, sondern hält an und
> fordert das Threat-Model an. Kein konservativer Default-Weiterbau — Design-Gate, kein
> Decision-Gate.

- [ ] **GATE G-BROWSER (zuerst, blockierend):** Threat-Model-Dokument liegt vor —
      Abuse-Cases für agent-getriebenen Browser mit echten Credentials; **Gate-pro-
      Aktion-Matrix** (welche Aktion welchen Human-Gate braucht); explizite Behandlung
      untrusted Web-Content → Egress/Secret-Read. **Zweiter Durchgang bestanden +
      Matze-Freigabe.** Wird Acceptance-as-Runbook (Overview §4.5). Erst danach öffnen
      die folgenden Schritte.
- [ ] **Live-Preview + Klick-zu-Quelle** (degradiert sauber bei Server-HTML).
- [ ] **Playwright** (E2E + Agent-Automation), on-demand provisioniert (Chromium pro
      Projekt-Container, nicht im Core).
- [ ] **Agent-Browser-Login über Broker:** Secret-by-reference, Credential nie im
      Context, nie im Agent-sichtbaren DOM/Log; jeder Login + jede Egress aus
      untrusted Seite → harter Human-Gate.
- [ ] **Adversarial-Test:** untrusted Seiteninhalt darf keinen Egress/Secret-Read
      auslösen; Agent-Login leakt das Passwort nie.

**Stolpersteine:** Klick-zu-Quelle nur für Komponenten-Frameworks; Playwright-
Chromium-Größe (on-demand); **Agent-Login-Sicherheit** (Secret nie im Context — die
Trifecta-Achse).

**Akzeptanz (real):** Die Live-Preview zeigt die laufende App, Klick auf ein Element
springt zur Quelle; ein Agent loggt sich über den Broker auf einer Staging-Seite
ein, **ohne das Passwort je zu sehen**; ein Egress-Versuch aus untrusted Seiteninhalt
wird gegated.

---

## Akzeptanzkriterien (Roadmap-Exit)

- Manuelle Real-Abnahme jeder Phase erfüllt.
- Conformance-Tests grün (echte Jira/DB/Sentry-Shapes vs. Fixtures).
- Adversariale Invarianten-Tests grün — **besonders** Browser-Trifecta + Prod-
  read-only + Secret-by-reference; Gates halten unter Angriff.
- Die volle Breite ist echt: echtes Ticket → echter Worktree-Container → echter
  Agent-Lauf mit echtem Quality-Grounding → echte DB-Query (Prod read-only) →
  Browser-Preview — alles durch den un-umgehbaren Broker.
