---
status: ready
block: Actually Works / Breadth
depends_on: [road-to-actually-works, road-to-real-breadth]
autonomy: "A (Contract/Fixture/Design-Port = autonom-grün) / B (Real-Provider, braucht Sentry-Token + Org-Slug) / C (Agent-Write-Injection-Threat-Model + Real-Abnahme = Matze)"
---

# Road to Sentry Observability — die Sentry-Ansicht (4 Tabs, 1:1 ans Design)

*Konkretisiert den Sentry-Teil von [`road-to-real-breadth`](road-to-real-breadth.md)
P3 (Observability-Provider + geteilte Signal-Schiene). Geteilte Doktrin,
Invarianten, Verifikationsdoktrin: siehe
[`00-actually-works-overview.md`](00-actually-works-overview.md). Setzt die
**OS-Keychain-Primitive** (`road-to-real-breadth` P0, erledigt) und die
**Minimal-Observability-Spine + `SignalFlyout`** (`road-to-actually-works` P3)
voraus. Akzeptanz = manuelle Real-Abnahme + Conformance/Invarianten-Tests, NICHT
„Test grün".*

**Goal:** Sentry direkt in der IDE — Issues, Cron Monitors, Performance, Alerts —
als eigener Workspace-Mode (`mode === "sentry"`, rechte Rail unter Tasks). Neue
Fehler und fehlgeschlagene Crons erscheinen als **IDE-Notification** (in der
bestehenden `SignalFlyout`-Schiene), ohne Browser-Kontextwechsel. Multi-Auth
(MCP/OAuth/Token/CLI, best-available) hinter der gemeinsamen `ProviderAuth`. Volle
Spec: [`agents/tmp/SENTRY-BACKEND-SPEC.md`](../tmp/SENTRY-BACKEND-SPEC.md).

> **Implementierungsstand (2026-06-29, autonomer Lauf):** **Phase 0 vollständig
> erledigt & verifiziert** (tsc, eslint, 738 Vitest grün, build, ladle:build,
> sidecar-conformance) — die vier Tabs rendern 1:1 aus deterministischen
> Fixturen, der Sanitizer-Gate (G-SENTRY-SANITIZE) ist mit adversarialen +
> Fuzz-Tests grün, der `sentry`-Mode ist voll verdrahtet. **P1–P4 bleiben offen**
> (Klasse B/C): sie brauchen einen echten Sentry-Token + Org-Slug (P1/P3), die
> Threat-Model-Real-Abnahme durch Matze (P2) und ggf. OAuth/Internal-Integration
> (P4) — autonom nicht abschließbar, daher bewusst nicht angefasst.

---

## Design-Bindung (NICHT verhandelbar)

```
DAS DESIGN IST DIE SPEZIFIKATION. 1:1 PORTIEREN. KEINE EIGENE INTERPRETATION.
```

- UI-Referenz: `SentryWorkspace` in
  [`agents/tmp/design-system/ui_kits/capisco-ide/views.jsx`](../tmp/design-system/ui_kits/capisco-ide/views.jsx),
  Daten in `shared.jsx` (`SENTRY_ISSUES`, `SENTRY_CRONS`, `SENTRY_STATS`,
  `SENTRY_ALERTS`, `SENTRY_LEVELS`).
- **CSS-Klassen verbatim** übernehmen (wie `GitWorkspace` es tut): `git-workspace`,
  `gitw-inner/head/title/tabs/tab/tcount/cols`, `sentry-stats`, `sst`,
  `sentry-filter`, `ch-sel`, `sentry-sel`, `sentry-search`, `sentry-issues`,
  `si-head/bar/title/name/culprit/tags/proj/env/status/graph/num/age/seen/assignee`,
  `sentry-crons`, `sc-head/row/name/mon/sched/status/checks/tick/alerts`,
  `sentry-alerthint`, `sentry-alerts`, `sa-row/dot/main/name/cond/toggle/knob/add`,
  `cc/cc-head/cc-title/cc-body`, `spark`. Charts aus
  `@/components/capisco/charts` (`LineChart`), `Sparkline` als inline-SVG (verbatim
  aus der Referenz).
- **Vier Tabs**, exakt: Issues · Cron Monitors · Performance · Alerts.
- **Farben (Spec §9, bindend):** Level `error → --error`, `warning → --warning`,
  `info → --accent`; Cron-Ticks ok `--success`, fail `--error`, timeout
  `--warning`. **Teal `#3FB6A8` als einziger Akzent — keine Sentry-Lila-Akzente.**
- Tabellen volle Breite, 1px-Borders, mono für Metadaten; Status-Bar-Breadcrumb
  `sentry › issues · production`.

### Council-Dissent — bewusst NICHT übernommen (Design schlägt Council)

Der AI-Council (2026-06-26, claude-sonnet-4-5 + gpt-4o, 3 Runden, design-lens)
empfahl drei **Design-Änderungen**, die gegen die obige Bindung verstoßen. Sie
werden **nicht** umgesetzt — hier dokumentiert für Nachvollziehbarkeit, nicht als
offene Frage:

1. *„Statt 4 Sentry-Tabs einen provider-neutralen Signals-Feed bauen."* →
   **Abgelehnt.** Das Design ist die 4-Tab-`SentryWorkspace`. Die provider-neutrale
   **Signal-Schiene** ist eine separate Sache und gehört zu `road-to-real-breadth`
   P3 („geteilte Signal-Fläche"); die Sentry-IDE-Notification *speist* diese
   Schiene (über die bestehende `SignalFlyout`), ersetzt aber den Sentry-Workspace
   nicht.
2. *„Sentrys Ampelfarben (rot/orange/lila) statt Teal."* → **Abgelehnt.** Spec §9
   ist explizit: Teal-only, Level = `--error/--warning/--accent`.
3. *„Performance-Tab streichen / als Regression-Signal in den Feed."* →
   **Abgelehnt als Streichung.** Der Performance-Tab ist im Design und wird gebaut
   (Council-Sequencing — *wann* — wird respektiert: P3; *ob* — nicht).

Alle **nicht-visuellen** Council-Findings (Security, Auth-Reihenfolge, Sequencing,
Scope-Fallen) sind dagegen eingearbeitet — siehe Gates und Phasen unten.

---

## Phasen-Reihenfolge

| # | Phase | Was es real macht | Braucht Dich |
|---|---|---|---|
| P0 | Contract + Fixture + Design 1:1 | Vier Tabs sichtbar, klickbar, aus Fixtures; Issue-Detail-Tab | nein (autonom-grün) |
| P1 | ProviderAuth + Real-Read (Token-first) | echte Issues live, Polling, single-org config; Kill-Switch | Sentry-Token + Org-Slug |
| P2 | Broker-gegatete Writes (anti-injection) | Resolve/Ignore/Assign/Alert-Toggle, alles broker-gegated | Threat-Model-Abnahme |
| P3 | Crons + Performance + Alerts + IDE-Notification | volle vier Tabs real, Signal-Schiene + Rail-Badge | Token-Scopes |
| P4 | Realtime (Webhooks) — optional, deferred | Push statt Polling, nur wenn Polling nachweislich nicht reicht | OAuth/Internal-Integration |

**Graph:** P0 (autonom) → P1 (erster echter Read, Kill-Switch zuerst) → P2 (Writes
hinter hartem Gate) → P3 (Breite) → P4 (isoliert, wahrscheinlich nie — Desktop-NAT).

---

## Gates (Council-Critical, blockierend)

> ⛔ **GATE G-SENTRY-SANITIZE (vor jedem Render von untrusted Sentry-Text).**
> Issue-Titel, Culprit, Stacktraces, Breadcrumbs, Tags sind **untrusted externer
> Content**. Bevor *irgendein* Sentry-Text gerendert wird: Sanitizer
> (`sanitizeIssueTitle/Culprit/Stacktrace`) — plain-text, 200-Zeichen-Truncation,
> kein `<script>`/`javascript:` — **plus hand-gebaute adversariale Fixtures**
> (XSS/SQLi/Überlängen, NICHT aufgenommen) **plus Fuzz-Test** (fast-check o.ä.).
> Aufgenommene Happy-Path-Fixtures testen die Sanitization NIE — das ist die
> Falle, die dieses Gate schließt. Landet in **P0**, vor dem ersten Render.

> ⛔ **GATE G-SENTRY-INJECT (vor jedem Write, der einen agent-/datengelieferten
> String enthält).** Bidirektionaler Injection-Vektor (Council-Top-Finding):
> Angreifer baut Issue-Titel → Agent parst → Agent ruft `assignIssue(böse@email)`
> → Broker prompted → Mensch bestätigt im Vertrauen auf den Agent. Abwehr: der
> **Broker validiert agent-gelieferte Strings (Email gegen Org-Membership, Project
> gegen Projektliste, Channel gegen Integrationsliste) VOR dem Human-Prompt** gegen
> die Sentry-API; schlägt Validierung fehl, Fehler an den Agent zurück (kein
> Prompt). Der Agent-Kontext sieht **nur strukturierte Daten**, nie rohe
> Titel/Stacktraces. Landet in **P2**, vor `assignIssue`. (Reversible String-lose
> Writes — Resolve/Ignore, Alert-Toggle-Boolean — brauchen die String-Validierung
> nicht, bleiben aber broker-gegated.)

---

## Phase 0 — Contract + Fixture + Design 1:1 portiert (autonom-grün)

**Goal:** Die vier Tabs sind sichtbar, klickbar, pixelgleich zum Design — aus
deterministischen Fixtures, kein echtes API, keine Writes. Vollständig
autonom-verifizierbar.

- [x] **Sentry-Contract** (`app/src/contracts/sentry.ts`): `SentryIssue`,
      `SentryCron`, `SentryStats`, `SentryAlertRule`, `SentryLevel` — Shapes exakt
      aus Spec §3 / `shared.jsx`. Read-only-Surface auf dem Wire; Writes NICHT auf
      dem Provider. <!-- done: SentryIssue bestand bereits (main); ergänzt um SentryCron/Stats/AlertRule/SentryCronStatus + `SentryReadProvider extends SentryProvider` (listCrons/getStats/listAlertRules), damit der bestehende RealSentryProvider (issues-only) nicht bricht. -->
- [x] **FixtureProvider** (`app/sidecar/sentry/fixture-sentry-provider.ts` +
      `register-sentry.ts`): mappt `SENTRY_*` aus aufgenommener JSON deterministisch
      (kein `Date.now`/`Math.random`) — exakt das Muster von `register-task-forge`. <!-- done: + load-fixtures.ts (node:fs), fixtures/capisco.sentry.json (verbatim Design-Werte), registriert in main.ts + ts-ipc-harness.ts; ProviderBundle.sentry + mock-providers verdrahtet. Frontend rendert aus sync `sentrySnapshot` (@/mocks/sentry), Muster wie gitSnapshot/tasksSnapshot. -->
- [x] ⛔ **G-SENTRY-SANITIZE erfüllt:** Sanitizer + adversariale Fixtures + Fuzz-Test
      grün, **bevor** Sentry-Text gerendert wird. <!-- done: app/src/lib/sentry-sanitize.ts (sanitizeText/IssueTitle/Culprit/Tag/Stacktrace — Tags+Winkel+gefährliche URI-Schemata+Control-Chars raus, 200-Zeichen-Cap) + 32 Tests inkl. 15 adversarialer Fixturen + deterministischer Fuzz (4000 Inputs, dependency-frei). Workspace pipet jeden untrusted String hindurch. -->
- [x] **Workspace-Mode `sentry` verdrahtet** (Downstream vollständig):
      `WorkspaceMode` in `store.ts` (+ `"sentry"`), `ActivityBar` MODES (Bug-Icon,
      `mode.sentry`-Label), `Shell.tsx`-Render-Switch, i18n-Keys (`mode.sentry`,
      `sentry.*`). <!-- done: + CommandPalette MODE_ICONS (Record<Exclude<WorkspaceMode,"diff">> erzwingt den Eintrag, sonst tsc-Fehler). -->
- [x] **`SentryWorkspace` 1:1 portiert:** vier Tabs, CSS-Klassen verbatim,
      `LineChart`/`Sparkline`, Teal-only, Level-Farben `--error/--warning/--accent`,
      Cron-Ticks `--success/--error/--warning`. Filterleiste, Issue-Tabelle, Cron-
      Tabelle, Performance-Charts, Alert-Liste mit Toggle. <!-- done: CSS verbatim in capisco-composer.css (Prototyp-`var(--accent)` → App-`var(--ds-accent)` = Teal; Tailwind-`--accent` blieb unangetastet). Sparkline neu erstellt; LineChart um optionalen `color`-Prop ergänzt (§9-Farben). -->
- [x] **Issue-Detail-View** (wie Ticket-Detail bei Tasks): Tags, Events/Users/Age/
      LastSeen, Aktionen-Buttons (Resolve/Ignore/Assign/„Open in Sentry") sichtbar,
      in P0 disabled. <!-- done: Row-Click öffnet eine In-Workspace-Detail-Ansicht (wie Tasks `view`-State, nicht ein zweiter App-Tab). Stacktrace/Breadcrumbs gibt es in den Fixturen nicht → ehrlicher Hinweis „kommt mit dem Real-Provider (P1)". -->
- [x] **Status-Breadcrumb** `sentry › <tab> · <env>`. <!-- done: im Workspace gerendert (`sentry-crumb`), NICHT in der globalen StatusBar — die ist ein statischer 1:1-Port und wird von keinem Mode (git/tasks) dynamisch beschrieben; Sentry zur Ausnahme zu machen wäre inkonsistent. -->
- [x] **Story + Render-Test** (Ladle/Vitest): vier Tabs rendern, Sanitizer verdrahtet,
      Detail öffnet/schließt. <!-- done: SentryWorkspace.stories.tsx + SentryWorkspace.test.tsx (6 Tests). Die XSS-Abnahme liegt in der Sanitizer-Suite (der einzige Render-Chokepoint); der Workspace-Test prüft, dass der Sanitizer verdrahtet ist + kein `<script>` im DOM. -->

**Stolpersteine:** Token-Mapping Design-System (`--accent` = Teal) ↔ App-Tokens
(`--accent` = Hover-Wash) — beim Port sauber auf die Brand-Teal-Rolle mappen, Spec
§9 ist bindend; Sparkline-/LineChart-Achsen; Issue-Detail als eigener Tab-Typ.

**Akzeptanz (autonom):** Du öffnest den Sentry-Mode, klickst alle vier Tabs, siehst
das Design pixelgleich aus Fixtures; eine XSS-Fixture rendert als harmloser Text;
Render-Test grün.

---

## Phase 1 — ProviderAuth + Real-Read (Token-first) + Kill-Switch

**Goal:** Echte Issues live, read-only. Multi-Auth hinter `ProviderAuth`, **Token-
first** (deckt 100 % der Sentry-API; MCP/OAuth folgen ohne Umbau). Polling, single-
org. **Der Kill-Switch landet zuerst.**

- [x] **Feature-Flag-Kill-Switch (zuerst, vor dem Real-Provider):** Sentry-
      Integration zur Laufzeit per IPC abschaltbar (kein Neustart) + Remote-Manifest-
      Force-Disable. Auslöser-Kriterien dokumentiert (API-Fehlerrate > 10 %,
      Broker-Reject > 20 %, Signal-Flut > 50/10 min) — Council-Finding.
      <!-- done: SentryKillSwitch (runtime setEnabled + forceDisabled-Override, letzterer
      gewinnt) + createGatedSentryProvider (disabled → leere Reads, KEIN Inner-Call →
      inert, nicht nur versteckt). register-sentry verdrahtet den GATED Provider +
      `sentry-control`-Wire (isEnabled/setEnabled/isForced); force-disable aus
      CAPISCO_SENTRY_DISABLED (Manifest-Feed später). Client-Bundle: sentryControl-Proxy
      + In-Memory-Mock. Tests: 8 (Toggle, Force-Override, inert-when-off, Re-Enable,
      Registry-Wiring). OFFEN: UI-Toggle-Button im Sentry-Workspace (Design-gated —
      additive Prototyp-Änderung) + Manifest-Fetch (P4-OAuth-nah). -->
- [x] **`ProviderAuth`-Abstraktion** (`mode: "mcp"|"oauth"|"token"|"cli"`) + Resolver
      (best-available, Präferenz aus `road-to-real-breadth` Provider-Auth-Direktive).
      Provider-Code spricht gegen `ProviderAuth`, nie gegen einen festen Modus.
      <!-- done: Abstraktion existierte bereits (real-breadth: basic/bearer/rawTokenAuth +
      selfAuth). Neu = `resolveProviderAuth(candidates)` + `AUTH_PREFERENCE`
      (mcp→oauth→token→cli): Provider deklarieren verfügbare Modi, Resolver wählt den
      besten; `build` läuft NUR fürs Gewinner-Candidate (kein unnötiger Keychain-Read);
      undefined → „not configured", nie geraten. Tests: 7 (Präferenz, token-fallback,
      cli-last-resort, none→undefined, build-only-winner, order, secret-by-reference). -->
- [ ] **RealProvider auf den Resolver umstellen** (heute fester `bearerTokenAuth`):
      Kandidaten-Liste (token verfügbar wenn Keychain-Ref gesetzt; oauth/mcp sobald
      gebaut) statt fixem Modus. <!-- Folge-Slice; RealSentryProvider existiert + nutzt token direkt -->
- [ ] **RealProvider read-only** (`real-sentry-provider.ts`, dünner Swap hinter dem
      gleichen Contract): Sentry Web API (`/api/0/`, self-hosted Base-URL
      konfigurierbar). **Token-Modus zuerst** — Org-Token aus der **OS-Keychain**
      (`road-to-real-breadth` P0), Scopes `project:read,event:read,org:read,
      alerts:read,member:read`; Token **nie im LLM-Context**, nie ins Subprozess-env,
      Injection am Execution-Layer.
- [ ] **`GET issues`** (Filter: `query`, `environment`, `statsPeriod=24h`) auf den
      `SentryIssue`-Shape; Default-Query `is:unresolved`, Default-Env `production`.
- [ ] **Polling-first** alle 30–60 s mit ETag/`statsPeriod`, 429-Backoff; letzte
      erfolgreiche Sync-Zeit als **„Updated Xs ago" + manueller Refresh** (Kontext,
      keine Entschuldigung — Council).
- [ ] **Single-org / single-project, manuelle Config** (zwei Textfelder: Org-Slug,
      Project-Slug), Validierung gegen `GET /projects/{org}/{project}/`. Multi-org +
      Slug-Auto-Matching **deferred** (Council: Config-UX-Falle, P2+).
- [ ] **MCP-Modus** (ein Sentry-MCP-Server ist verfügbar) und **OAuth-Modus** als
      weitere Modi hinter `ProviderAuth` — MCP für LLM-native Tool-Calls mit Fallback
      auf Token bei Tool-Lücken; OAuth wird in P4 für Webhooks gebraucht.

**Stolpersteine:** Sentry-Query-Syntax 1:1; ETag-Handling; MCP-Tool-Scope-Lücken →
Fallback auf Token (Council-Footgun); Token-Scopes minimal halten.

**Akzeptanz (real):** Du hinterlegst einen echten Sentry-Token, sieh­st echte
Issues Deines Org/Projects in der Tabelle; ein Toggle des Kill-Switch blendet die
Integration zur Laufzeit aus; der Token überlebt einen App-Neustart.

---

## Phase 2 — Broker-gegatete Writes (anti-injection)

**Goal:** Aktionen aus dem Issue-Detail real — aber jeder externe Write läuft durch
den Broker, genau wie der Ticket-Status-Write in `ticket-lifecycle.ts`
(untrusted → `ask` → Human-Resolver → Ausführung als `human`-Principal).

- [ ] **Resolve / Ignore** (`PUT /issues/{id}/`): reversibel, low-risk, string-los —
      broker-gegated, kann (per Policy) leise auto-approven; im Audit-Log.
- [ ] ⛔ **G-SENTRY-INJECT erfüllt — Assign:** `assignIssue(id, assignee)` —
      **Broker validiert `assignee` gegen `GET /organizations/{org}/members/` VOR dem
      Prompt**; ungültig → Fehler an den Agent, kein Prompt. Erst danach Human-Gate.
- [ ] **Alert-Rule Toggle** (`PUT .../rules/`, Boolean on/off): broker-gegated.
- [ ] **Agent-Kontext härten:** der Agent sieht nur strukturierte Sentry-Daten, nie
      rohe Titel/Stacktraces (verhindert, dass injizierter Text einen Write wählt).
- [ ] **Notification-Dedup-Spec** (Council, ~70 Z.): Dedupe-Key **pro Signal-Typ**
      (Issue-Group-ID / Monitor-ID-pro-Fenster / Alert-Rule-ID-pro-Fenster),
      Rate-Limit z. B. 1/5 min/Group; **Quiet-Hours mit Severity-Override** —
      `error`/`fatal` benachrichtigen immer, `info`/`warning` werden in den
      Working-Hours-Ruhezeiten unterdrückt.
- [ ] **Adversarial-Test:** ein per Issue-Titel injizierter `assignIssue`-Versuch
      mit Fake-Email scheitert an der Broker-Validierung, **bevor** ein Prompt
      erscheint.

**Deferred (Council-Scope-Fallen, bewusst raus):** „Create ticket" → durch **„Open
in Sentry"**-Deep-Link ersetzt (Sentrys eigene Tracker-Integrationen, keine
dynamischen Formulare nachbauen); Create-Monitor / Create-Alert-Rule-Editor → P3+
(Spec-MVP §10 listet sie nicht).

**Stolpersteine:** Broker-Policy pro Operation (auto-approve vs. prompt);
Org-Membership-API-Form; Quiet-Hours × kritische Alerts.

**Akzeptanz (real):** Du resolvst ein echtes Issue (broker-gegated, Status springt
in Sentry); ein Assign an eine Nicht-Org-Email wird strukturell geblockt; ein
injizierter Write-Versuch scheitert vor dem Prompt.

---

## Phase 3 — Cron Monitors + Performance + Alerts + IDE-Notification

**Goal:** Die vollen vier Tabs real, plus die Signal-Schiene.

- [ ] **Cron Monitors real:** `GET /organizations/{org}/monitors/` + `.../checkins/`;
      Status `ok/failing/timeout` aus letzten Check-ins, Tick-Leiste (grün/amber/rot),
      Alert-Count, Monitor-Detail (Check-in-Historie, Intervall, Margin).
- [ ] **Performance real:** `GET /organizations/{org}/events-stats/` +
      Release-Health → die **bestehenden `LineChart`-Komponenten** (Design 1:1):
      p95 Transaction Duration, Apdex, Throughput, Crash-free Sessions.
- [ ] **Alerts real:** Alert-Rules lesen + On/Off-Toggle (P2-Write-Pfad);
      Bedingung + Channel + Level-Punkt; Hinweiszeile „New errors and missed crons
      surface as IDE notifications."
- [ ] **IDE-Notification** in die bestehende `SignalFlyout`-Schiene (`SignalItem`/
      `SignalSeverity`) + Badge am Sentry-Rail-Icon; Klick öffnet betroffenes
      Issue/Monitor als Tab. Trigger: neues Issue/Reopen, Error-Rate-Schwelle, Cron
      missed/failed, Crash-free-Drop, p95-Regression — je aktiver Regel. Dedup +
      Quiet-Hours aus P2.
- [ ] **Slug-Mapping auf geladene Projekte** (Spec §8): nur Sentry-Projekte zeigen,
      die zu den geladenen IDE-Projekten gehören; Crons i. d. R. am Backend-Projekt.

**Deferred:** Create-Monitor, Alert-Rule-Editor (Bedingung/Schwelle/Fenster/
Channels), langsamste-Transactions-Tabelle/Trace-Drilldown — wenn nachgefragt.

**Stolpersteine:** `events-stats`-Aggregation auf die Chart-Buckets; Check-in-
Aggregation zu Status; Signal-Dedup über Issue/Cron/Alert hinweg.

**Akzeptanz (real):** Ein echter Sentry-Fehler erscheint in der `SignalFlyout`-
Schiene neben Container-Health und PR-Status; ein fehlgeschlagener Cron triggert
eine IDE-Notification; die Performance-Charts zeigen echte p95/Apdex-Zahlen.

---

## Phase 4 — Realtime (Webhooks) — optional, deferred

**Goal (nur wenn Polling nachweislich nicht reicht):** Push statt Polling.

> Council-Warnung: ein Desktop hinter NAT/Firewall kann Webhooks **nicht** direkt
> empfangen (kein routbarer Endpoint, Port-Kollision, Corporate-Firewall). Optionen:
> lokaler Tunnel (ngrok — Sicherheitsrisiko), Cloud-Relay (= Cloud-assistiertes
> Polling, nicht echt-realtime, eigener Dienst), oder Polling lassen. Für eine
> Desktop-IDE ist **Polling 30–60 s mit ETag korrekt, kein Kompromiss** — diese
> Phase ist bewusst zuletzt und feuert nur auf Beleg eines echten Bedarfs.

- [ ] **Bedarfs-Beleg:** belege, dass die Polling-Latenz einen realen Workflow
      bricht — sonst Phase schließen (`[-]`, Begründung).
- [ ] **OAuth-Modus + Internal Integration** (hinter `ProviderAuth`) für die
      Webhook-Registrierung.
- [ ] **Webhook-Receiver** (Issue created/resolved, monitor check-in failed) → Push
      an die IDE; Secret-Verifikation; Fallback bleibt Polling.

**Akzeptanz (real):** Ein echtes Sentry-Event erscheint per Push (statt nach dem
nächsten Poll) in der Signal-Schiene — *oder* die Phase ist mit Begründung
geschlossen.

---

## Akzeptanzkriterien (Roadmap-Exit)

- Manuelle Real-Abnahme jeder offenen Phase erfüllt.
- Design 1:1: die vier Tabs sind pixelgleich zur `SentryWorkspace`-Referenz, Teal-
  only, Level-Farben `--error/--warning/--accent`.
- Conformance-Tests grün (echte Sentry-Shapes vs. Fixtures).
- Adversariale Invarianten grün — **besonders** G-SENTRY-SANITIZE (untrusted Text
  rendert sicher) + G-SENTRY-INJECT (kein Write aus injiziertem Text, String-
  Validierung vor dem Prompt) + Token-by-reference (nie im Context).
- Echter Sentry-Fehler → Issue-Tabelle → broker-gegateter Resolve → IDE-
  Notification in der geteilten Signal-Schiene — alles durch den un-umgehbaren
  Broker.

---

## Council-Konvergenz (2026-06-26, claude-sonnet-4-5 + gpt-4o, 3 Runden, design-lens)

**Übernommen (nicht-visuell):** (1) Sanitization + adversariale Fixtures + Fuzz vor
Render (G-SENTRY-SANITIZE); (2) Broker validiert agent-gelieferte Strings gegen die
Sentry-API vor dem Prompt — bidirektionaler Injection-Vektor (G-SENTRY-INJECT,
Top-Finding); (3) Feature-Flag-Kill-Switch vor dem Real-Provider; (4) **Token-first**
statt MCP-first (MCP-Tool-Scope-Lücken), MCP/OAuth bleiben Modi hinter
`ProviderAuth`; (5) **Polling-first**, Webhooks deferred (Desktop-NAT); (6) single-
org/single-project manuell, Multi-org deferred; (7) Notification-Dedup per Signal-
Typ + Quiet-Hours-Severity-Override; (8) „Create ticket" gestrichen → „Open in
Sentry"-Deep-Link; Create-Monitor/Alert-Editor deferred.

**Nicht übernommen (Design bindend, siehe Dissent-Block oben):** federated Signals-
Feed statt 4 Tabs; Sentry-Ampelfarben statt Teal; Performance-Tab streichen.
