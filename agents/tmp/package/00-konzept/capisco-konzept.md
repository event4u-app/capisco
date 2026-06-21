# Capisco — Agent-native, schlanke IDE

*Internes Architektur- und Visionsdokument. Stand: Juni 2026.*

> **Name.** *Capisco* — italienisch „ich verstehe" (1. Person von *capire*). Der Dreh:
> *Capisce?* („verstehst du?") ist die Frage, die jeder Entwickler seinem Tool und seiner
> KI stillschweigend stellt — gerade angesichts des Markt-Schmerzes „fast richtig, aber
> nicht ganz". *Capisco* ist die selbstbewusste Antwort der IDE: *ich hab's verstanden.*
> Der Name ist damit nicht nur ein italienisches Wortspiel, sondern *on-thesis* — er
> benennt das eigentliche Alleinstellungsmerkmal (Grounding/Verstehen statt
> Halluzination, §4.3). CLI-tauglich und eindeutig zu sprechen (ka-PEES-ko, hartes
> Ende): `capisco run`.
>
> **Offen (vor Festlegung zu prüfen):** Domain (`capisco.dev`/`.io`), npm-Paketname,
> GitHub-Org, EUIPO-Markenregister (eine gleichnamige, fachfremde App existiert — Klasse
> prüfen). Markenrechtliche Freiheit ist noch *nicht* geklärt.

---

## 1. Leitidee

Die meisten IDEs werden um den **Editor** herum gebaut. Capisco wird um den
**Agent-Workflow** herum gebaut. Der Editor ist ein gelöstes Problem (Monaco,
CodeMirror); der Wert liegt in der dünnen, meinungsstarken Schicht darüber, die
menschliche und KI-gestützte Arbeit isoliert, überwacht, erdet und reviewbar macht.

Drei Eigenschaften definieren das Produkt:

- **Schlank** im residenten Kern, Kaltstart und Idle-Footprint — nicht zwingend in
  der maximalen Gesamtinstallation. Schwere Fähigkeiten (Browser-Automation,
  Sprach-Toolchains) werden *on demand, pro Projekt, in den Projekt-Container*
  provisioniert, nicht in den Core gebündelt.
- **Lokal-first** — der Kern telefoniert nicht nach Hause. Persönliche Metriken
  verlassen die Maschine nicht (es gibt keinen serverseitigen Datenpfad dafür).
- **Agent-nativ** — paralleles Arbeiten von Mensch und mehreren Agenten ist der
  Normalfall, nicht ein aufgesetztes Feature.

Zielgruppe ist zunächst **intern** (eigene Company). Verkauf/Monetarisierung ist
explizit kein aktuelles Designkriterium.

---

## 2. Die drei Primitive

Das gesamte System steht auf drei orthogonalen Konzepten. Jedes Feature aus der
Vision dockt an genau eines davon an.

### 2.1 Der Ort — Worktree-Workspace-Runtime

> Jede Aufgabe — Mensch oder Agent — läuft in einem eigenen, isolierten,
> reviewbaren Workspace. Ein Workspace = ein Git-Worktree + optional eine
> Runtime-Instanz (Container o. Ä.).

Das löst in einem Zug mehrere Anforderungen:

- **Projekt mehrfach auschecken & nebeneinander laufen lassen** → Git-Worktrees
  (ein Repo, mehrere Arbeitsbäume gleichzeitig).
- **Parallele Instanzen ohne Port-Kollision** → Port-Allocator + Reverse-Proxy
  (Traefik), der per Hostname routet (`projekt-a.localhost`, `projekt-b.localhost`).
- **"Was hat der Agent verändert" / Diff vom Agent-Lauf** → fällt geschenkt heraus:
  der Agent arbeitet in *seinem* Worktree/Branch, am Ende ist es `git diff` gegen
  die Base. Live-Tracking = Worktree watchen, geänderte Dateien streamen.

Die Runtime ist **austauschbar** (siehe Runtime-Provider): Docker ist *eine*
Implementierung, Podman eine andere, "nativ ohne Container" eine dritte.

### 2.2 Das Gespräch — Session-Tree

> Eine Session = ein Gesprächs- und Ausführungsfaden mit einem Modell. Hat Modell,
> Status, Historie, Runtime, Token-/Kostenzähler. Ein Subagent = eine Kind-Session,
> die sich den Workspace der Eltern teilt, aber eigenen Context und eigene
> Token-Abrechnung hat, die nach oben aggregiert.

- **Mehrere KIs parallel** (ChatGPT, Claude, lokale Modelle) = mehrere
  `ModelProvider` hinter einem Interface, mehrere Sessions gleichzeitig live.
- **Mehrere Sessions pro KI** = fällt heraus, weil die Session die Einheit ist,
  nicht das Modell.
- **Überwachung** (Tokenverbrauch, Runtime, "was tut der Agent gerade") = die
  Visualisierung des Baums. Je sauberer das Datenmodell, desto besser die Aufsicht.

Ein **ordentlicher Session-Store ab Tag eins** ist Pflicht — aus ihm fallen ab:
- **Resume** = Session aus dem Store rehydrieren.
- **Chat-Suche** = Store indizieren.
- **Retry** = *verzweigt*, überschreibt nicht (neuer Branch im Gesprächsbaum, alte
  Antwort bleibt erhalten).
- **Copy** = trivial.

Bindung an Primitiv 1: **Eine Session handelt in einem Workspace.** Ort und Gespräch
sind orthogonal, aber gekoppelt.

### 2.3 Der Stecker — Provider-Registry

> Der Kern ist dünn: die Runtime plus ein Satz Registries. Alles andere — auch die
> First-Party-Features — sind Provider, die sich einklinken. Jeder Provider ist über
> eine stabile ID adressierbar.

**Es gibt kein separates "Plugin-System". Die ganze IDE ist aus Plugins
zusammengesetzt.** First-Party-Features und Dritt-Plugins nutzen dieselbe API. Das
ist der einzige Weg zu einer Plugin-API, die nicht verrottet: Dogfooding — die
eigenen Features sind der erste Härtetest.

**Disziplin:** Die API zuerst rein *intern* härten, erst dann für Dritte öffnen.
Eine veröffentlichte API kann man nicht mehr brechen. Ein neuer Provider muss sich
seinen Default-Platz auf der Oberfläche *verdienen*, statt ihn geschenkt zu bekommen.

---

## 3. Der Capability-Broker (Permissions + Secrets)

Das wichtigste und gefährlichste Subsystem. Permissions und Secrets sind *ein*
Subsystem, nicht zwei.

### 3.1 Grundmodell

Der Broker mediiert: **(Principal) × (Capability) × (Scope) → Entscheidung.**

- **Principal** ist *jeder* Akteur — Mensch wie Agent. Der Mensch ist kein
  privilegierter Bypass; ein heikler Befehl durchläuft denselben Gate, egal wer ihn
  auslöst.
- **Capability** = Dateie-Edits, Shell, Netzwerk-/Browser-Aktionen, Secret-Zugriff,
  Rückschreiben in externe Systeme (Ticket-Status, Test-User anlegen), DB-Zugriff.
- **Scope** = worauf (Projekt, Datasource, Kommandomuster …).

Für **reguläre Capabilities** existiert eine Grant-Achse:
*jedes Mal fragen / einmalig / Session / dauerhaft-scoped / verweigern* — persistiert
pro Projekt. (Vorbild: das Permission-Modell von Claude, z. B. `Bash(git commit:*)`
erlaubt, `Bash(rm:*)` fragt nach.)

### 3.2 Harte Invarianten (keine Grant-Achse)

Manche Regeln sind **kein** Punkt auf einer Achse, sondern unverhandelbar:

- **Secrets gelangen niemals in den LLM-Context.** Der Broker ist ein Tresor, der
  *im Auftrag* handelt. Das Modell bekommt eine Referenz (`credential: staging-admin`),
  der Broker injiziert das echte Login erst zur Ausführungszeit in den Browser-/
  HTTP-Layer. Begründung: Sähe der Agent das Passwort, landete es im Prompt an
  OpenAI/Anthropic, in der Chat-Historie, in Logs, im resumebaren Store.
  Capability-by-reference statt value-by-context.
- Der Tresor ist **bidirektional**: injizieren beim Lesen; beim Schreiben (Agent legt
  Test-User an) *vorschlagen*, in den Tresor zurückzuschreiben — mit Freigabe, nie in
  den Chat.
- **Audit-Log** für alle mächtigen Aktionen (Agent + Prod-nahe Credentials + Browser).
  Versicherung, keine Bürokratie.

### 3.3 Produktiv-Datenbanken: Invariante, kein Grant

Ein Spezialfall, der explizit *nicht* dem regulären Grant-Modell folgt:

- Eine als `production` markierte Datasource ist **read-only für alle Principals**
  (Mensch wie Agent). Das ist Default *und* nicht zu einem Dauerzustand aufweichbar.
- Es gibt **kein "dauerhaft erlauben"** für Prod-Schreibzugriff. Kein "remember this",
  kein Session-weites "ab jetzt darf ich schreiben". Genau dieses Häkchen ist die
  Katastrophe, die man verhindern will.
- Der einzige Ausstieg ist **per-Befehl, einmalig, explizit**: "diesen einen Query
  schreibend ausführen", nicht "Schreiben einschalten". Nach der Ausführung ist die
  DB wieder read-only, ohne dass jemand etwas zurückstellen muss.

> Unterschied in einem Satz: Bei normalen Capabilities *darf* "dauerhaft" eine Option
> sein; bei Prod-Schreibzugriff ist "dauerhaft" verboten und nur "dieses eine Mal"
> existiert. Read-only ist der einzige Ruhezustand, in den das System nach jeder
> Ausnahme von selbst zurückfällt.

---

## 4. Provider im Detail

Alle folgenden sind Instanzen der Registry aus 2.3.

### 4.1 Model-/Agent-Provider — ACP als Transport

**Strategische Weichenstellung.** Das **Agent Client Protocol (ACP)**, von Zed und
JetBrains seit Anfang 2026 als offener Standard getrieben, ist fast deckungsgleich
mit dem hier entworfenen Session-/Agent-Primitiv: JSON-RPC über stdio (lokal) bzw.
HTTP/WebSocket (remote), die IDE mediiert Datei-/Terminal-/Tool-Zugriff.

Wenn der Agent-Layer **ACP spricht**, fallen Claude Code, Codex CLI, GitHub Copilot
CLI, Gemini CLI, OpenCode u. v. m. aus der ACP-Registry praktisch geschenkt an —
statt jeden einzeln zu integrieren. ACP deckt zudem den Cloud-vs-lokal-Wunsch ab und
fügt sich in den Broker (die IDE entscheidet, was läuft).

**Empfehlung:** ACP-Spec lesen und bewusst entscheiden, ACP als Transport zu
übernehmen, bevor irgendeine Agent-Anbindung selbst gebaut wird. Es ist das
NDJSON-stdio-Sidecar-Muster, nur als Industriestandard.

### 4.2 Language-Packs (sprach-agnostisch)

Der Kern weiß von keiner Sprache etwas. Jedes Pack bringt mit: LSP, DAP (Debugger),
Test-Runner, Quality-Tools, Formatter. Beispiele:
- **Rust** → rust-analyzer, DAP, `cargo test`.
- **JS/TS/React** → tsserver, Node-Debug, Vitest/Jest.
- **PHP** → Intelephense/phpactor, xdebug (DBGp), Pest/PHPUnit, PHPStan/Rector/ECS.
- **HTML/CSS** → jeweilige LSPs.

Unterstützt werden ausdrücklich auch HTML, JS, React, Rust u. a. — nicht nur PHP.

### 4.3 Quality-Provider + KI-Review

PHPStan, Rector, ECS (und Pendants anderer Sprachen) sind abstrakt dasselbe:
*Analyzer, die strukturierten Output emittieren*. Vereinheitlicht unter einem
Tool-Runner, der im Container des Workspaces läuft, Output parst und als Diagnostics
+ anwendbare Fixes anbietet.

**Kernprinzip (stärkstes Verkaufsargument intern):** Die deterministischen Tools
**erden die KI**. Marktweit ist "fast richtig, aber nicht ganz" die Frustration
Nr. 1. Ein KI-Review, das erst die harten Tools laufen lässt und dem LLM deren
Ergebnisse als Grundwahrheit gibt, ist höhere Qualität *und* ehrlicher als ein LLM
allein auf dem Diff. Loop: Tool findet Fehler → Agent fixt im Worktree → Mensch
reviewt den Diff.

### 4.4 Test-Provider

Pest/PHPUnit/JS/E2E als Teil der Language-Packs, strukturierter Output wie die
Quality-Tools. **Tests debuggen** = denselben DAP-Host wiederverwenden (kein neues
Subsystem). Offene Marktflanke: komplexes Debugging (Race Conditions, State-Bugs) —
ein Agent, der den *echten* Debugger fährt (Breakpoints, State-Inspektion), statt zu
raten, wäre eine echte Differenzierung. Infrastruktur dafür ist ohnehin geplant.

### 4.5 Task-Provider (Jira & Linear)

Ticketsysteme wie Sprachen behandeln: ein `TaskProvider`-Interface, Jira und Linear
als Implementierungen (MCP als natürlicher Transport). Dashboard: "meine Tickets",
"nächstes Ticket aus dem Sprint ziehen".

**Schleife (Ticket-Lifecycle = Worktree-Lifecycle):**

```
Ticket ziehen  → Worktree + Runtime hoch        → Status: In Progress
arbeiten (Mensch/Agent) im Worktree
fertig         → Diff + Quality + KI-Review      → Status: In Review
Merge          → Worktree weg                    → Status: Done
```

Bidirektional, ohne manuelle Statuspflege. **Achtung:** Bidirektionaler Sync ist
tückisch (Webhooks, Konflikte, Rate-Limits, unterschiedliche Sprint-/Status-Semantik
je System). Mit einer Richtung beginnen, schrittweise voll-bidirektional.

### 4.6 Forge-Provider (PRs + Awareness)

Zwilling des Task-Providers, für GitHub/GitLab/Gitea/Bitbucket.

- **PR-Übersicht**: offen/gemerged, "wartet auf wen", Alter.
- **Zentraler Filter "wessen Zug ist es?"** vereint: fremde PRs, in denen ich
  Reviewer bin (ich blockiere das Team), *und* meine PRs mit angefragten Changes.
- **Stale-PR-Regel**: älter als N Tage (Default 7, einstellbar).
- **Awareness (git.live-Stil, asynchron, git-basiert):** wer arbeitet wo, welche
  Branches überlappen mit meinen uncommitteten Änderungen, drohende Merge-Konflikte
  (Drei-Wege-Diff vor dem Merge), Cherry-Picking. Lokal-first-kompatibel.

**Designgabel für spätere "frühe Konfliktwarnung":** Konfliktvorhersage braucht
Einblick in *uncommittete* Änderungen Anderer. Entweder Beschränkung auf gepushte
Branches (rein lokal-first, aber Warnung erst nach Push) oder ein leichter
Presence-Dienst (frühere Warnung, optionaler Server). Bewusst entscheiden.

**Verworfen:** Vollwertiges Code-with-me (Echtzeit-Co-Editing). Gründe: bricht
lokal-first (ständiger Sync-Server), kollidiert mit dem Broker (Gast-Principal,
fremde Code-Ausführung in meiner Umgebung) — und das zugrunde liegende Bedürfnis
schrumpft, weil der dritte Akteur im Raum zunehmend ein Agent ist (man synchronisiert
Absichten/Ergebnisse, nicht Tastendrücke). Calls laufen über Slack/Teams, nicht
selbst gebaut.

### 4.7 Datasource-Provider (DBs, Redis, …)

DataGrip-/dbForge-artige Funktionalität als Provider (Redis, MySQL, Postgres …).

- **Raw Queries** mit schema-bewusster Autovervollständigung (= SQL-LSP über den
  LSP-Host), Filtern, Dumpen, Einspielen.
- **Struktur-/Daten-Vergleich** (z. B. prod → lokal) recycelt den Diff-Viewer.
- **Daten zwischen identischen Tabellen** zweier DBs synchronisieren/kopieren.
- **Query-History mit Rückgängig** — vierte Historie (siehe 5.1).
- **Read-only-Invariante für Prod** (siehe 3.3) — gilt für Mensch *und* Agent.

**Einziges echt neues Engineering hier — Tenant-Fan-out:** Lesender (und bestätigt
schreibender) Query über N gleich strukturierte Tenant-DBs (eine RDS-Instanz, je
Kunde eine DB mit identischen Tabellen) mit Ergebnis-Aggregation. Lesend frei;
schreibend nur mit **Per-Ausführung-Bestätigung** (nie Persistenz-Pfad). Das ist die
maximal heikle Variante des Broker-Gates.

**Ehrliche Grenze:** Query-Rückgängig ist tückischer als Git-Rückgängig. Ein
Snapshot-vor-Schreibzugriff lässt sich zurückspielen, aber Kaskaden, Trigger und
Effekte in externen Systemen macht kein Rollback sauber rückgängig — dieselbe
Seiteneffekt-Wahrheit wie bei Git-Checkpoints.

### 4.8 Runtime-Provider (Container-Monitoring)

Container-Monitoring (ctop-artig) ist eine **Projektion** des Orchestrators aus
Primitiv 1, kein neues System:
- **Auslastung/Status/Fehler pro Container** = `docker stats`-Stream (dieselbe
  Live-Telemetrie-Plumbing wie die Token-/Runtime-Anzeige des Session-Trees).
- **In die Container-Console verbinden** = `exec -it` über die bestehende
  Terminal-Abstraktion (xterm.js), nur mit Shell im Container statt auf dem Host.
- Speist in die geteilte Signal-Fläche (5.2) ein → "Container läuft heiß/wirft Fehler"
  ist dieselbe Form wie Sentry-Errors oder Stale-PR-Alerts.

Nicht an Docker hängen: Runtime-Provider mit Docker/Podman/nativ als
Implementierungen. ctop ist die *Docker-Sicht* eines allgemeinen Monitorings.

### 4.9 Observability-Provider

Sentry, Datadog, New Relic per MCP. **Grafana — zwei strikt getrennte Zielgruppen:**
- **Dev-Grafana** (eigene Projekte) = normaler Provider/Embed.
- **IDE-Selbst-Monitoring** (Fehler bei eigenen Nutzern erkennen) = eigene
  Telemetrie-Pipeline mit Consent-Implikationen. Strikt opt-in, gescrubbt, **niemals**
  etwas aus Tresor oder Projektcode. Vertrauensfrage, kein Feature-Toggle.

### 4.10 Schema-Katalog (Config-Autocomplete)

90 % von "Autocomplete für Config-Datei X" reduziert sich auf **YAML + JSON-Schema**:
*ein* YAML-LSP, gezeigt auf SchemaStore.org → Taskfile, docker-compose,
GitHub-Actions, GitLab-CI, k8s u. v. m. auf einen Schlag. **Makefile** ist die
Ausnahme (eigene Grammatik → dediziertes LSP). Nebeneffekt: Sobald die IDE
Taskfile/Makefile versteht, kann sie deren Tasks als ausführbare Befehle anbieten
(Command-Palette → Tool-Runner). Tür, die das Autocomplete nebenbei aufstößt.

### 4.11 ToDo-Provider (Markdown-ToDos → Agent)

Löst eine konkrete tägliche Reibung: ToDos in Markdown schreiben und sie später manuell
in einen Agenten kopieren. Statt Copy-Paste wird die ToDo-Zeile direkt aktionabel.

- **Anklickbare ToDo-Items** in Markdown-Dateien (`- [ ] …`) und/oder eine dedizierte
  interne ToDo-Liste. Erkennung über den Markdown-Editor (Phase 0).
- **"An Agent senden"** pro Item: ein Klick startet eine neue Session (ACP, §4.1) mit
  dem ToDo-Inhalt als Prompt — optional im aktuellen oder einem neuen Worktree.
- **Status-Rückkopplung**: erledigte/laufende ToDos können mit der ausgelösten Session
  verknüpft bleiben (offen → in Arbeit → erledigt), analog zur Ticket-Schleife (§4.5),
  nur leichtgewichtig und lokal.

**Strategische Einordnung:** Kein neues Primitiv — die Verbindung von Markdown-Editor
(Phase 0) und Session-Tree/ACP (Phase 5). Es ist die *kleinste* Instanz der Kernidee
"strukturierter Inhalt → Agenten-Aktion" und damit ein **Mikro-Nordstern**: ein winziger
Durchstich Editor → Agent, früh baubar und sofort täglich nutzbar. Validiert die
Architektur, statt sie zu belasten.

---

## 5. Querschnitts-Schichten

### 5.1 Historien (vier getrennte Tiere, nicht ein Monster)

| # | Historie | Granularität | Backing |
|---|----------|--------------|---------|
| 1 | Undo/Redo | Tastenanschlag, pro Buffer, In-Memory | Editor (CodeMirror/Monaco), geschenkt |
| 2 | Lokale Datei-History | Snapshot bei Save/externer Änderung, pro Datei | eigener schlanker Shadow-Store, **getrennt von Git** |
| 3 | Checkpoint-History | projektweit, an Chat-Punkt verankert | **Git-Tree, getaggt mit Session-Message-ID** |
| 4 | Query-History | pro ausgeführtem Query | Datasource-Provider, Snapshot-vor-Schreiben |

Historie 2 ist das "der Agent hat meine Datei zerlegt"-Rettungsnetz — auch für nie
committete Dateien, ohne die Git-Historie zuzumüllen.

Historie 3 (Lovable-Stil "im Chat zurückspringen"): Git *ist* bereits ein
content-adressierter Snapshot-Store. Jeder akzeptierte Agent-Schritt committet auf
einen Shadow-Branch, beschriftet mit der Message-ID → Chat-Timeline und Git-Timeline
sind dieselbe Timeline aus zwei Blickwinkeln. "Zurück zu Punkt X" = checkout des
zugehörigen Trees.

**Ehrliche Grenze (gilt für 3 und 4):** Code-Revert macht *Code* rückgängig, nicht
Nebenwirkungen draußen (gelaufene Migration, angelegter Test-User). "Zurück zu X"
heißt: Code-Zustand X, reale Welt = wo sie ist. Dem Nutzer im UI ehrlich sagen.

**UX:** Die datei-feine (2) und projekt-grobe (3) Historie dürfen als *ein* Scrubber
mit zwei Auflösungen präsentiert werden — ein Bedienkonzept, zwei Backings.

### 5.2 Geteilte Signal-Fläche

Eine Benachrichtigungs-Fläche für alles, was Aufmerksamkeit braucht: Stale-PR,
"wartet auf mich", Container-Health, Observability-Alerts. **Nicht zweimal bauen.**
Regel-Seite bewusst **dumm** halten — zwei, drei eingebaute Regeln, keine generische
Rule-Engine zu Beginn. Polling-Limits beachten, Alert-Müdigkeit vermeiden (lieber
selten und präzise).

### 5.3 Geteilte Browser-Fläche

*Ein* gemanagter Browser für drei Bedarfe (nicht drei Browser):
- **Live-Preview** (Lovable-Stil) mit Klick-zu-Quelle.
- **Playwright** (E2E + Agent-Automation).
- **Agent-Browser-Login** über den Broker (Secret-by-reference).

Klick-zu-Quelle: DOM-Elemente zur Dev-Zeit mit Quell-Herkunft instrumentieren
(`data-source` = Datei:Zeile:Komponente). Ein Klick → dieselbe Komponenten-ID für
drei Konsumenten: Mensch springt zur Quelle, Agent kriegt das Ziel, Debugger hängt
sich an (Fiber-Inspection + optional Breakpoints über den JS-Debug-Host).

**Grenze:** Klick-auf-Komponente funktioniert für **Komponenten-Frameworks**
(React/Vue/Svelte, auch Rust-WASM wie Leptos/Dioxus). Bei **server-gerendertem HTML**
(Blade/Twig/ERB/handgeschrieben) degradiert es zu "DOM-Element → Template-Zeile".
Generelle Grenze, kein Framework-Defizit.

**Footprint-Ehrlichkeit:** Playwright bringt einen Chromium mit (mehrere hundert MB) —
größer als das mit Tauri bewusst vermiedene Electron. Deshalb: on demand pro Projekt
in den Container provisionieren, nicht in den Core bündeln. Das hält die
Leichtigkeits-These (residenter Kern, nicht Gesamtinstallation) intakt.

### 5.4 Presets / Sichtbarkeit (UX-ler, PO, …)

Die IDE ist auch für UX-ler, PO etc. nutzbar — nicht über eine zweite Codebasis,
sondern über eine **Sichtbarkeits-Schicht** über den ohnehin existierenden Providern.
Toolbar-Icons/Panels einzeln ein-/ausblendbar; gespeicherte Zustände = **Presets**
(ehrlicher als feste "Rollen"). Ein PO-Preset zeigt Dashboard, Tickets, PR-Board;
blendet Editor/Debugger/LSP-Kram aus.

**Regel:** "Icon ausgeblendet" ≠ "Feature deaktiviert". Ausgeblendete Features bleiben
über die Command-Palette auffindbar. Ausblenden ist Kosmetik, nicht Entzug.

### 5.5 Persönliche Metriken (Git-Dashboard)

Unter dem Git-Reiter: "Was habe ich diese Woche gemacht" — LoC, Commits, offene/
gemergte PRs, Sprachen-Pie, Graphen. Filter: Tag/Woche/Monat/custom.

- **Lokal-first**: Aggregation passiert auf der Maschine. **Es gibt keinen
  serverseitigen Sammelpfad** — Vergleich zwischen Nutzern ist architektonisch
  ausgeschlossen, nicht nur per Einstellung verboten. Niemand sieht fremde Zahlen.
- **LoC-Warnung**: nur als *Aktivität* labeln, nie als *Leistung*, nie als
  Team-Rangliste (Goodhart — ein Refactor, der 800 Zeilen löscht, ist gute Arbeit).

### 5.6 Optik, Design-System & Layout

**Referenz: JetBrains New UI (PhpStorm), Dark Theme.** Das ist das verbindliche
Vorbild für Dichte, Proportionen, Farben, Tab-Verhalten und Statusleiste. Die Linie
ist nicht *karg*, sondern *geordnet-dicht*: viel Information, aber jede Zone mit klarer
Aufgabe. "Schlank" meint hier Ordnung und Proportion, nicht Leere.

#### 5.6.1 Layout-Zonen (von außen nach innen)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Titelleiste: Projekt-Dropdown · Branch-Switcher · Run/Debug ·         │
│              Such-/Settings-Icons · Agent-Plugin-Icons                 │
├───┬──────────────────┬────────────────────────────────────────┬──────┤
│ A │  Linkes Panel    │  Editor-Bereich                        │  A   │
│ c │  (kontextabh.:   │  ┌──────────────────────────────────┐  │  c   │
│ t │   Commit/Project/│  │ Tab-Leiste (pinnbar)             │  │  t   │
│ i │   PR/DB/…)       │  ├──────────────────────────────────┤  │  i   │
│ v │                  │  │ Editor / gerendertes MD          │  │  v   │
│ i │                  │  │                                  │  │  .   │
│ t │                  │  └──────────────────────────────────┘  │ -Bar │
│ y ├──────────────────┴────────────────────────────────────────┤ (KI/│
│ - │  Bodenpanel: Terminal (umbenennbare Tabs) / Problems / …   │ Tool│
│Bar│                                                            │ s)  │
├───┴────────────────────────────────────────────────────────────┴─────┤
│ Statusleiste: Breadcrumb · Sprache · Δ-Status · Blame · Server ·      │
│               Zeile:Spalte · LF · UTF-8 · Einrückung · …              │
└─────────────────────────────────────────────────────────────────────┘
```

- **Zwei Activity-Bars** (links *und* rechts), schmal, Icon + Kurzlabel. Links
  Navigation/Werkzeuge (Project, Commit, PR, Structure, DB, Remote Host, Services,
  Terminal, Problems, Git). Rechts Assistenten/Panels (Notifications, AI Chat, Agenten,
  Inspections). Das aktive Werkzeug ist dezent hervorgehoben (nicht grell).
- **Linkes Panel ist kontextabhängig** — zeigt je nach gewähltem Activity-Bar-Icon
  Commit-View, Projektbaum, PR-Liste, DB-Explorer etc. Nicht alles gleichzeitig.
- **Editor mittig mit pinnbarer Tab-Leiste.** Pin-Icon am Tab. Tabs zeigen Dateityp-
  Icon + Name; Markdown wird wahlweise gerendert dargestellt.
- **Bodenpanel** für Terminal/Problems/Run, zusammenklappbar.
- **Rechte Bar** beherbergt die KI-/Agent-Flächen — hier dockt nativ der **Session-Tree**
  an (statt, wie in der PhpStorm-Referenz, Agenten in Terminal-Tabs zu betreiben und
  Token/Runtime aus dem Terminal-Text ablesen zu müssen).

#### 5.6.2 Farbsystem (Dark Theme, als Tokens zu hinterlegen)

| Rolle | Charakter | Richtwert |
|-------|-----------|-----------|
| Editor-Hintergrund | sehr dunkel, leicht warm/neutral, *nicht* reinschwarz | ~`#1E1F22` |
| Tool-Window-Hintergrund | etwas heller als Editor, klare Zonentrennung | ~`#2B2D30` |
| Rahmen/Trenner | sehr subtil, niedriger Kontrast | ~0.1–0.15 α |
| Primärtext | helles Off-White, nicht reinweiß | ~`#DFE1E5` |
| Sekundärtext (Pfade, Hints) | gedämpftes Grau, klar zurückgesetzt | ~`#868781` |
| Akzent/Links | Teal/Cyan-Blau | ~`#3592C4` / Teal |
| Diff added | Grün (Zeile + Gutter) | grün |
| Aktiv/Selektion | dezenter Blau-Tint, kein Vollflächen-Knall | subtil |

Prinzip: **wenige Hintergrund-Ebenen** (Editor < Tool-Window < Eingabefelder), Zonen
durch minimale Helligkeitsunterschiede getrennt, nicht durch dicke Rahmen. Akzentfarbe
sparsam (Links, aktive Zustände). Hell-Theme spiegelt dieselben Token-Rollen.

#### 5.6.3 Typografie & Dichte

- **Zwei Schriftfamilien:** Sans-Serif für UI-Chrome und gerendertes Markdown;
  **Monospace** für Editor und Terminal.
- **Kompakte Zeilenhöhe**, kleine, aber lesbare Schriftgrade. Die Dichte der Referenz
  ist hoch — Listen, Tabellen, Statuszeile packen viel auf wenig Raum, ohne zu lärmen.
- **Sekundärinformation konsequent gedämpft** (Dateipfade hinter Dateinamen, Hints im
  Terminal). Das ist der Haupttrick gegen "überladen": nicht weniger zeigen, sondern
  Wichtigkeit über Helligkeit staffeln.

#### 5.6.4 Statusleiste (eigene, wichtige Komponente)

Informationsdicht, aber ruhig — Pflichtbestandteil, kein Detail. Felder (Referenz):
Breadcrumb-Pfad zur aktuellen Datei · Sprach-/Versionsanzeige (z. B. PHP 8.0) ·
Git-Δ-/Sync-Status · Blame (Autor + Datum der aktuellen Zeile) · Server-Status ·
Cursor-Position (Zeile:Spalte) · Zeilenende (LF/CRLF) · Encoding (UTF-8) ·
Einrückung (z. B. 4 spaces) · diverse Status-Icons rechts. Jedes Feld klickbar/aktionabel
wo sinnvoll (Encoding wechseln, Zeilenende wechseln …).

#### 5.6.5 Greifbarkeiten (die "fühlt sich richtig an"-Schicht)

Diese Kleinigkeiten machen den PhpStorm-Eindruck aus und sind *Geschmacksarbeit*, die
iterativ gegen die Referenz geschliffen werden muss — nicht an den Agenten delegierbar:
pinnbare Tabs, Drag-Reorder von Tabs, Kontextmenüs überall, Doppelklick-Rename,
Hover-Reveals, korrekte Spacing-Rhythmen, dezente aktive Zustände. Sie wirken mühelos,
*weil* viel Politur darin steckt (über zwanzig Jahre JetBrains). "Sieht einfach aus"
und "ist einfach zu bauen" liegen hier maximal weit auseinander.

#### 5.6.6 Übergreifende Prinzipien

- **Ruhiger Default + Eskalationsleiter:** still im Ruhezustand, Tiefe einen Schritt
  entfernt (Command-Palette, Hover-Reveals, Progressive Disclosure). Dichtes Material
  (Session-Tree-Tokens, Container-Stats, Diagnostics) darf reich sein, wenn man
  hinschaut — nicht dauernd ins Gesicht springen.
- **Token-getriebenes Design-System** (Spacing/Farbe/Typo als wenige Tokens, überall
  gleich). Hell/Dunkel fällt daraus heraus; derselbe KI-Settings-Pfad ("stell auf
  dunkel") greift ohne Sonderbehandlung.
- **Aufgeräumtheit ist fortlaufende Kuratierung, kein Theme.**
- **Tischstakes erben, nicht erfinden:** Editor-Kern und Fenster-Mechanik so nah wie
  möglich an einer Basis halten, die diese Greifbarkeiten mitbringt. Der nicht
  delegierbare Eigenwert liegt im agent-nativen Teil (Session-Tree, Broker,
  Worktree-Review), nicht im Nachbau der Tab-/Statusleisten-Politur.

### 5.7 Editor-Affordances (Code-Komfort)

Standard-Komfort, "wie man ihn kennt" — überwiegend **vom Editor-Kern
(CodeMirror 6 / Monaco) bzw. den LSPs geliefert**, nicht selbst zu erfinden. Das ist
ein Argument *für* eine reife Editor-Basis (siehe 5.6.6, Tischstakes erben).

- **Formatierung & Auto-Einrückung** — über die Formatter der Language-Packs (§4.2,
  LSP-`formatting` / dedizierte Formatter wie ECS/Prettier). Format-on-Save optional
  (per Settings, auch KI-setzbar).
- **Autovervollständigung** — schema-/symbol-bewusst über LSP (§4.2). Für Config-Dateien
  zusätzlich über den Schema-Katalog (§4.10).
- **Rainbow-Brackets** — Klammernpaare farblich gestaffelt (Referenz: das
  JetBrains-Plugin gleichen Namens). Monaco bringt *bracket pair colorization* nativ
  mit; CodeMirror 6 über Erweiterung. **Eigene Token-Rolle im Design-System**, damit
  Hell/Dunkel und KI-Settings konsistent greifen.
- **Einrückungs-Hilfslinien** (vertikale Indent-Guides), inkl. Hervorhebung des aktiven
  Blocks — beide Editor-Kerne unterstützen das.
- **Code-Folding** — Blöcke/Klammern faltbar; Folding-Ranges kommen vom LSP, der Editor
  rendert die Falt-Steuerung im Gutter.
- **Passend zur Referenz** außerdem: Syntax-Highlighting, Klammern-Matching,
  Multi-Cursor, Gutter mit Zeilennummern + Git-Markern + Folding-Controls.

Diese Liste ist bewusst als "erben, nicht bauen" markiert: Der Aufwand liegt im
*Verdrahten und konsistenten Theming*, nicht im Implementieren der Grundmechanik.

### 5.8 Terminal

Über die Terminal-Abstraktion (xterm.js, §4.8) hinaus zwei Referenz-Anforderungen:

- **Umbenennbare Tabs.** Jeder Terminal-Tab trägt einen editierbaren Namen (Default =
  Shell/Kommando), per Doppelklick umbenennbar (Referenz: Tabs wie "Local", "Py2Ts",
  "Evidence"). Trivial in der Umsetzung, spürbar im Alltag.
- **Mehrere Terminals nebeneinander** als Tabs, schließbar, mit Backing wahlweise
  Host-Shell oder Container-Shell (`exec -it`, §4.8).

### 5.9 Mehrsprachigkeit & Updates

- **UI-i18n** (react-i18next o. Ä.) ab **Tag eins** (Nachrüsten ist die Hölle).
- "Einfache Übersetzung" als Inhalt = nur ein Agent-Task.
- **Update-System**: Tauri-Updater (simpel, kein Risiko).

### 5.10 Token-Ökonomie

Ziel: Tokens sparen, ohne Grounding/Präzision (die Kernthese) zu opfern. Drei Teile,
die *unterschiedliche* Hälften des Token-Problems treffen — Telemetrie/Handoff, die
Beobachtungs-Seite (was der LLM liest) und die Output-Seite (was der Agent sagt).

#### 5.10.1 Telemetrie-Ampel + komprimierter Session-Handoff

Sitzt auf der vorhandenen Session-Tree-Telemetrie (`Telemetry {tokensIn,tokensOut,
runtimeMs}`, `aggregateTelemetry`). Ein **konfigurierbarer Schwellwert** färbt ein
Indikator-Icon im Chat **grün → orange → rot**. Bei **rot** fragt Capisco (wie Claude
Code), ob eine **neue Session** gestartet werden soll.

- Der „neue Session"-Pfad nutzt den Session-Store (`copy`/`retryAsBranch`/`resume`).
- **Besser als ein leerer Neustart:** Option, die neue Session **mit einer komprimierten
  Zusammenfassung** der alten zu starten (über die Memory-Kompression aus §5.10.3). Der
  Handoff-Schritt ist der natürliche Treffpunkt von Telemetrie und Kompression.
- Schwellwerte (orange/rot) sind pro Session/Projekt einstellbar.

#### 5.10.2 RTK — Observation-Compressor (installieren/anbieten)

RTK (Rust-Binary, Apache-2.0) komprimiert **Tool-Ausgaben, bevor sie in den Kontext
gelangen** (60–90 % auf `ls`/`find`/`docker ps`/beliebigem CLI). **Input-Seite.**

- **Wird angeboten/installiert, nicht gebündelt** (Shell-out aus dem Sidecar). Fehlt es,
  degradiert Capisco sauber (kein Hard-Fail).
- **Nur auf dem LLM-zugewandten Beobachtungs-Pfad** und **nur für den unstrukturierten
  Long-Tail** — also Kommandos *ohne* nativen strukturierten Parser. git (B1) und
  Quality-Tools (B5) parsen Capisco bereits typisiert/strukturiert; diese **autoritative**
  Ausgabe bleibt unverändert die Quelle für UI und Broker. RTK ersetzt sie nie.
- **Nie auf dem Audit-/Diagnostic-/Broker-Pfad.** Eine externe Kompression darf die
  Fakten, auf die der Broker sich verlässt, nicht anfassen (Trust-Surface-Grenze).

#### 5.10.3 Caveman — nativer Terse-Modus (Default an, opt-out)

Caveman (MIT) ist mechanisch eine **Verhaltens-/Prompt-Schicht**, die den Agenten terse
antworten lässt (~65–75 % weniger **Output**-Tokens, Reasoning unberührt). Da Capisco den
ACP-Client selbst besitzt, wird der **Regelsatz vendored/adaptiert** (mit Attribution) und
nativ in den System-Kontext der Session injiziert — **kein** installierter Skill.

- **Default an, opt-out pro Session.** Level-Switch (lite/full/ultra) in der
  Composer-Control-Bar, direkt neben „reasoning effort".
- **Opt-out muss trivial erreichbar sein** (sichtbarer Toggle), weil der Chat
  menschen-zugewandt ist. **Einmaliger Hinweis** beim ersten terse Output, damit er nicht
  als „kaputt/unhöflich" missverstanden wird.
- **Harte Grenze — Caveman formt *Erklärung*, nie *Fakten oder Safety-Flächen*.**
  Unabhängig vom Toggle bleiben **immer voll ausführlich/präzise**: Quality-Diagnostics &
  Tool-Fakten (die KI-Erdung — sie terser zu machen unterliefe die Grounding-These),
  Broker-Permission-Prompts (Sicherheits-Sprache), Secret-Referenzen, Audit-Log,
  Commit-Messages. Diese Flächen umgehen den Terse-Modus strukturell.
- **Memory-Kompression** (caveman-compress-Äquivalent): komprimiert getragenen Kontext /
  Handoff-Zusammenfassungen → speist den „neue Session mit Zusammenfassung"-Pfad (§5.10.1).

#### 5.10.4 Querschnitt

- **Determinismus:** RTK ist ein Parser → in den deterministischen Harness integrierbar.
  Caveman ist LLM-*Verhalten* → getestet wird die **Injektion** des Regelsatzes, nicht der
  terse Output selbst.
- **Benchmark-Skepsis:** Die 65–90 %-Zahlen beider sind selbstberichtet → als Richtung
  behandeln, nicht als Zusage.
- **Lizenz:** RTK Apache-2.0 (Dependency/Install). Caveman MIT (Regelsatz vendored, mit
  Attribution).
- **These-Konsistenz:** Default-Terse wählt Kosten/Tempo — legitim für ein internes
  Power-Tool, *solange* die harte Grenze (Fakten/Safety bleiben präzise) und der sichtbare
  Opt-out gelten. Sonst kollidiert „Capisco = ich verstehe" mit genuscheltem Output.

---

## 6. Technischer Stack

| Schicht | Technologie | Anteil |
|---------|-------------|--------|
| Shell | **Tauri** (Rust, OS-Webview statt mitgeliefertem Chromium) | dünn, ~Boilerplate |
| Orchestrierung | **Node-/Bun-Sidecar (TypeScript)** — Worktrees, Runtime, Provider, Broker, Agents | Hauptlogik |
| Frontend | **React (TypeScript)** — Editor, Tabs, Diff, Terminal, Agent-Panel, Palette | UI |

- **~90 % TypeScript.** Alles ist I/O- und Subprozess-Koordination — kein CPU-bound
  Bottleneck, der Rust erzwingt. Rust nur für die native Naht; punktueller Rust-Helper
  als *Ausnahme*, falls echte Perf-Wand (z. B. Suchindex über Monorepo).
- **Electron verworfen** (Gegenteil von leichtgewichtig). Tauri für kleinen
  Footprint/schnellen Start.
- **Footprint-Note:** Node-Sidecar schleppt eine Runtime mit (~40–80 MB) → Single-Binary
  kompilieren oder Bun. Immer noch viel leichter als Electron.
- **Reife Bausteine anlehnen, nicht neu bauen:** Monaco/CodeMirror, ripgrep (globale
  Suche), gitoxide/libgit2, Devcontainer-CLI, bestehende LSP/DAP-Server, ACP-Agents.

---

## 7. Nordstern-Workflow

Aus der gesamten Vision der *eine* Workflow, der das schärfste Versprechen bündelt —
zuerst end-to-end bauen, der Rest gruppiert sich darum:

```
Ticket ziehen
  → isolierter Worktree + Runtime          (Primitiv 1)
  → Agent arbeitet (ACP)                    (Primitiv 2, §4.1)
  → Quality-Tools erden den Lauf            (§4.3)
  → Mensch reviewt sauberen, verifizierten Diff
  → Merge schiebt Ticket-Status             (§4.5)
```

Dieser eine Pfad adressiert gleichzeitig die zwei größten Marktschmerzen ("fast
richtig, aber nicht ganz" und "KI kennt unsere Standards nicht") und nutzt
Worktree-, Broker- und Quality-Schicht in einem Zug.

---

## 8. Phasen-Roadmap

**Leitprinzip der Priorisierung (auf Wunsch festgehalten):** *Alles* aus dem Konzept
soll am Ende drin sein — das ist die Vision eines zentralen Tools, nicht eine Auswahl.
Aber der Aufbau erfolgt **wert-zuerst statt infrastruktur-zuerst**: In *jeder* Phase
soll ein im Alltag nutzbares Tool stehen, statt monatelang auf Vollständigkeit zu warten.
Die Reihenfolge ist nach *differenzierendem Wert pro Aufwand* sortiert, nicht nach
technischer Schichtung.

> **Ehrlicher Rahmen:** Phasen lösen das *Zeit*-Problem (in jeder Phase nutzbar), nicht
> das *Aufwands*-Problem (die Gesamtarbeit bleibt). Das ist ein **Mehrjahres-Tool** ohne
> Enddatum, kein Projekt mit Stichtag. Schwergewichte wie die Datasource-Schicht
> verschwinden nicht, sie kommen später — bewusst nach dem differenzierenden Kern.

### Block A — Nutzbares Fundament (sofortiger Eigennutzen)

- **Phase 0 — Editor-Shell & Design.** Tauri-Shell + React + Editor, Ordner öffnen,
  Dateibaum, Tabs (pinnbar, Drag-Reorder, Rename). Editor-Affordances aus dem Kern
  (Highlighting, Autocomplete-Anbindung, Rainbow-Brackets, Indent-Guides, Folding —
  §5.7). Design-System nach JetBrains-Referenz (§5.6): Zwei-Bar-Layout, Farb-Tokens
  Dark/Light, informationsdichte Statusleiste, umbenennbare Terminal-Tabs. i18n-Gerüst.
  Politur läuft ab hier als eigener Strom über alle Phasen mit (§5.6.5).
- **Phase 1 — Git-Basis.** status, Diff-Viewer, stage/commit, globale Suche (ripgrep),
  lokales Aktivitäts-Dashboard (lokal-first). Ab hier ist das Tool ein brauchbarer
  Editor mit Git.

### Block B — Der agent-native Kern (das eigentliche Alleinstellungsmerkmal)

Hier liegt der differenzierende Wert. Diese Phasen zuerst gedanklich durchdesignen.

- **Phase 2 — Agent-Bridge (ACP) + ToDo-Brücke.** Session-Store, Session-Tree,
  Subagents, Überwachung (Tokens/Runtime). ACP als Transport (§4.1). **Capability-Broker**
  parallel von Anfang an (§3) — nicht nachrüsten. Als **Mikro-Nordstern** sofort der
  **ToDo-Provider** (§4.11): anklickbares Markdown-ToDo → Agent-Session. Kleinster
  Durchstich Editor → Agent, täglich nutzbar.
- **Phase 3 — Worktree-Manager.** Anlegen/wechseln/zerstören. Das Rückgrat für isolierte
  Agenten-Läufe. Diff vom Agent-Lauf reviewbar.
- **Phase 4 — Quality-Erdung + KI-Review.** Quality-Provider (PHPStan/Rector/ECS &
  Pendants) als Tool-Runner; KI-Review auf harten Tool-Fakten geerdet. **Das ist das
  schärfste Versprechen** ("fast richtig" → verifiziert).
- **Phase 5 — Nordstern schließen.** Task-Provider (Jira/Linear, erst lesend),
  Ticket→Worktree→Quality→Review→Status-Schleife end-to-end. Ab hier lebt der
  Kern-Workflow aus §7.

### Block C — Echtes Entwickeln (Sprach-Tiefe & Laufzeit)

- **Phase 6 — Language/DAP.** LSP-Tiefe + Debugger pro Language-Pack; Test-Provider
  (Pest/PHPUnit/JS/E2E), Tests im Debugger. Editor-Affordances voll über LSP.
- **Phase 7 — Runtime + Routing.** Container/Devcontainer pro Workspace, Port-Allocator,
  Traefik, xdebug mit Path-Mappings. Runtime-Monitoring (ctop-artig), Container-Console.
  Schema-Katalog/Config-Autocomplete (§4.10) fällt hier mit ab.

### Block D — Team- & Tooling-Breite

- **Phase 8 — Forge + Awareness + Signal-Fläche.** PR-Board, "wessen Zug ist es",
  Stale-Alerts (Default 7 Tage), git.live-artige Awareness. Signal-Fläche als geteilte
  Benachrichtigungsschiene.
- **Phase 9 — Observability.** Sentry/Datadog/New Relic (MCP), Dev-Grafana-Embed; speist
  in die Signal-Fläche. IDE-Selbst-Telemetrie strikt opt-in (§4.9).
- **Phase 10 — Browser-Fläche.** Live-Preview/Klick-zu-Quelle, Playwright, Agent-Login
  über Broker — *ein* gemanagter Browser (§5.3).

### Block E — Schwergewichte (bewusst spät, hoher Aufwand, abgegrenzt)

- **Phase 11 — Datasource-Provider.** Queries/Autocomplete/Diff, Prod-Read-only-Invariante,
  Tenant-Fan-out, Query-History. **Ehrlicher Hinweis:** größter Einzelbrocken, trägt
  *nicht* zum agent-nativen Kern bei — zuerst prüfen, ob ein bestehender DB-Provider
  eingebunden/daneben betrieben werden kann, bevor DataGrip-Funktionalität nachgebaut
  wird (§4.7).
- **Phase 12 — Plugin-API öffnen.** Erst nach internem Härten durch Dogfooding (§2.3).
- **Später / bewusst spät:** "frühe Konfliktwarnung" mit Presence-Entscheidung (§4.6).
  Verworfen bleibt vollwertiges Code-with-me (§4.6).

> **Reihenfolge-Logik:** Block B (agent-nativer Kern) steht *vor* Block C (Sprach-/
> Laufzeit-Tiefe), obwohl letzteres "fundamentaler" wirkt — weil der differenzierende
> Wert in B liegt und Block A+B bereits ein einzigartiges Tool ergeben, das C/D/E dann
> verbreitern. Wer infrastruktur-zuerst baut (erst DAP, erst Container, erst DB), hat
> lange nichts Differenzierendes in der Hand.

---

## 9. Wiederkehrende Designprinzipien

1. **Konvergenz vor Sprawl.** Neue Features sollen an ein bestehendes Primitiv/einen
   Provider andocken, nicht ein neues Primitiv erfinden. Über elf Gesprächsrunden hat
   das durchgehalten — auch die ToDo→Agent-Brücke und die DB-Schicht sind Provider.
2. **Vollständige Vision, phasenweiser Bau.** Das Ziel ist ein zentrales Tool, in dem
   am Ende alles steckt. Der Weg dahin ist wert-zuerst priorisiert, sodass in *jeder*
   Phase ein nutzbares Tool steht. Phasen lösen das Zeit-, nicht das Aufwandsproblem —
   bewusst ein Mehrjahres-Tool.
3. **Architektonische Eleganz ≠ billige Implementierung.** "Ist nur ein Provider" senkt
   die *gedankliche* Komplexität, nicht die *Bauarbeit*. Jeder Provider ist real Arbeit;
   manche (Datasource, Jira-Sync) sind eigene Produktklassen. Beim Schätzen die
   Konvergenz nicht mit Günstigkeit verwechseln.
4. **Tischstakes erben, Kern selbst bauen.** ~85 % der Oberfläche (Editor, Git, LSP,
   DAP, DB-Tools, PR-Boards) existiert anderswo und sollte angelehnt/eingebunden werden.
   Der nicht delegierbare Eigenwert sind ~15 %: die agent-native Schleife und der
   einheitliche Broker. Dort liegt die Politur-Investition.
5. **Der Wert liegt im bewussten Weglassen.** Aufgeräumte Oberfläche, dumme Regel-Engine,
   intern gehärtete API, kein Code-with-me. Disziplin steigt, wenn Baukosten (dank KI)
   sinken.
6. **Ehrlichkeit über Grenzen.** Seiteneffekte überleben Code-Reverts; Klick-zu-Quelle
   braucht Komponenten; Playwright ist schwer; LoC ist Aktivität, nicht Leistung;
   Query-Rollback ist kein echtes Undo. Grenzen im UI benennen, nicht Vollständigkeit
   vortäuschen.
7. **Lokal-first als Default, Server als bewusste Ausnahme.** Jede Abweichung
   (Selbst-Telemetrie, Presence) ist opt-in und explizit, nie versehentlich.
8. **Invarianten ≠ Defaults.** Manche Regeln (Secrets nie im Context, Prod read-only)
   sind keine Punkte auf einer Grant-Achse, sondern unverhandelbar.
