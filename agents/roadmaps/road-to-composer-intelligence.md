---
status: ready
block: Composer / Input-Intelligence
depends_on: ["road-to-actually-works.md", "road-to-real-runtime.md"]
autonomy: "A (Primitive, /-Commands, @file, Empty-State, History/Drafts/Paste, ML-Tier hinter Settings) autonom baubar / B (LSP-@symbol + Agent-Cockpit-Runtime-Features S5/S6/S7 hängen an echten Run-Loop-/Capture-Primitiven aus road-to-actually-works / road-to-real-runtime)"
---

# Road to Composer-Intelligence — der Input, der mitdenkt

*Diese Roadmap macht den Composer (das Chat-/Agent-Eingabefeld) so clever wie
Claude Desktop / Claude Code — und an den Stellen, wo Capisco Repo-Wissen hat,
ein Stück besser. Quelle: AI-Council-Runde 2026-06-26 (4 Lenses: Desktop-Parität,
Agent-Power-User, Input-Intelligence, Critical-Challenger + Synthese), danach
Feature-Triage durch Matze (siehe Entscheidungs-Tabelle). Akzeptanz =
manuelle Real-Abnahme + Unit/Visual-Goldens, NICHT „Test grün".*

**Goal:** Du tippst `/` und siehst sofort jeden registrierten Command; Du tippst
`@` und hängst die **exakte** Datei / den Ordner / das Symbol an (sichtbar als
entfernbarer, broker-getaggter Chip); ein **leeres** Eingabefeld schlägt
repo-bewusste nächste Schritte vor, statt kalt dazustehen; vorige Prompts kommen
mit einem Tastendruck zurück, Entwürfe überleben den Tab-Wechsel; im Agent-Modus
wird der Composer zum Cockpit (Edit-&-Rerun als Branch, Message-Queue,
Mid-Run-Steering); und eine abschaltbare ML-Schicht obendrauf rankt, vervollständigt
und schärft Prompts — jeder Assist mit deterministischem Fallback.

> **Implementierungsstand (2026-06-29, autonomer Lauf):** **Phase 0 vollständig
> erledigt & verifiziert** (tsc, eslint 0 Fehler, prettier, 731 Vitest grün,
> build, ladle:build) — das geteilte Autocomplete-Overlay-Primitiv steht: ein
> Tokenizer für `@`+`/`, eine Provider-Engine, `@project` re-mounted ohne
> Verhaltens-/DOM-Change, MRU + zuschaltbares Fuzzy. **P1–P6 bleiben offen.**
>
> **AI-Council-Konvergenz (2026-06-29, 3 Sonnet-Lenses: Scope · Architektur ·
> Critical-Challenger, einstimmig):** Erste autonome PR = **nur P0**; P1 nicht
> mitbündeln (sonst landet das Fundament + die erste Verhaltensänderung zusammen
> → Regressionen nicht zuordenbar). **Folge-Sequenz:** PR2 = P1 (`/`-Commands,
> **ohne S9 Saved-Prompts** — die hängen an P4s Prompt-Log; Arg-Hints brauchen
> eine `Command`-Schema-Erweiterung); PR3 = P4 (History/Drafts/Paste/Auto-Grow,
> **ohne Diktat S14**) — baut das Per-Session-Prompt-Log, das P3/P6 konsumieren;
> PR4 = P3 (Empty-State, deterministisch); PR5 = P2 (`@file`/`@folder`, **ohne
> `@symbol`/LSP**); danach P5-A (Edit-Rerun/Queue/Checkpoint, **gated auf den
> real-runtime-Track** wegen `subscribe('done')`-Kollision). **Deferred (nicht
> autonom baubar):** `@symbol`/LSP, P5-B-Tail S5/S6/S7 (ACP-Inject / adressierbare
> Subagents / Capture-Provider existieren nicht), P6-ML-Legs (brauchen Modell-
> Backend), S14 Diktat (OS-Speech).

---

## Ist-Stand (geerdet, verifiziert im Code)

- `MentionAutocomplete.tsx` kann **nur `@project`** (Liste der zuletzt geöffneten
  Projekte) und koppelt die Auswahl fest an `openProject()`-Navigation
  (`MentionAutocomplete.tsx:101-131`). Keyboard-/Overlay-/Stale-Logik existiert,
  ist aber an **einen** Trigger gelötet.
- Command-Palette (Cmd-K) + `command-registry.ts` existieren — Actions
  self-registrieren (`usePalette.registered`, `Command{id,label,group,icon,keywords,run}`).
  Aber **kein** inline-`/`-Autocomplete im Composer.
- File-Ingestion läuft durch **einen** Broker-Chokepoint
  (`ingest.ts` · `ingestFile`): prod-Herkunft → read-only-Tag, Secret-Form → Refusal-Chip.
  Chip-Reihe (`cmp-context`) + Drag&Drop + `+Add` nutzen alle diesen einen Pfad.
- **Keine** Empty-State-Vorschläge, **keine** Prompt-History, **keine**
  Draft-Persistenz, **kein** Smart-Paste.
- `SessionTree.branch()` (Retry-als-Branch, nicht-destruktiv) existiert im
  Datenmodell (`session-store.ts:7-8,105`), hat aber **keinen** Composer-Trigger.
- **Es gibt heute KEINE** Broker-Capture-Provider für Diff/Selektion/Terminal und
  **kein** ACP/Run-Loop-Inject-Frame — S5/S6/S7 sind darauf gegated (siehe P5).

## Querschnitts-Invariante — Design-Fidelity (Council-Gegenlesen)

```
DAS TEXTAREA TRÄGT DIE PROTOTYP-KLASSE cmp-ta VERBATIM (PIXEL-1:1).
OVERLAYS RENDERN STRIKT AUF STATE-TRANSITION (TASTENDRUCK / LEER-ZUSTAND),
NIE BEIM DEFAULT-BOOT — SONST BRECHEN DIE VISUAL-GOLDENS.
KEINE CONTENTEDITABLE-/RICH-PILL-UMSCHREIBUNG DES INPUTS (S13 → später).
```

## Querschnitts-Invariante — ML-Tier ist abschaltbar & token-bewusst

```
JEDER MODELL-GESTÜTZTE ASSIST (P6 + S1) HAT EINEN DETERMINISTISCHEN FALLBACK,
IST PER SETTING ABSCHALTBAR, UND FEUERT NIE STILL AUF EINEM HEISSEN IDLE-PFAD.
ML MUSS SICH VERDIENEN — DEFAULT BLEIBT DETERMINISTISCH.
```

---

## Feature-Entscheidungen (Triage 2026-06-26 — entschieden)

> Die Council-Skip-Kandidaten, von Matze entschieden. *Entscheidung* = Matzes
> Votum (verbatim). *Landet in* = Phase, in die das Feature eingearbeitet wurde.
> *Caveat* = Council-Warnung, die als **Bau-Vorgabe** in den jeweiligen
> Phasen-Schritt eingeflossen ist.

| # | Feature | Modus | Caveat (Bau-Vorgabe) | Entscheidung | Landet in |
|---|---|---|---|---|---|
| S1 | ML-gerankte Empty-State-Vorschläge | agent | Token-Kosten + Latenz auf heißem Idle-Pfad, nicht-deterministisch → feindlich zu 1:1-Goldens. Deterministische Variante (P3) bleibt Fallback. | _einbauen_ (per Setting deaktivierbar) | **P6** |
| S2 | Ghost-Text Inline-Autosuggest | both | Modell-Variante braucht Low-Latency-Streaming + kämpft mit Pixel-Goldens. History-only-Heuristik zuerst. | _einbauen_ | **P4** (Heuristik) + **P6** (Modell) |
| S3 | Prompt-Linting / „improve this prompt"-Rewrite | both | Extra Modell-Roundtrip pro Aufruf. Heuristik-Lints deterministisch, Rewrite nur auf explizite Anforderung. | _einbauen_ | **P4** (Lints) + **P6** (Rewrite) |
| S4 | Intent-Auto-Detect → Chat-vs-Agent-Vorschlag | both | Wert hängt an nicht-nerviger Heuristik; nie Auto-Switch. | _einbauen_ (per Setting deaktivierbar) | **P6** |
| S5 | Mid-Run-Steering (Notiz injizieren ohne Stop) | agent | **Braucht echtes ACP/Run-Loop-Inject-Frame; existiert NICHT.** Mock liefert nur Run-State-Signale. | _einbauen_ | **P5** (B · gegated) |
| S6 | `@`-Mention eines laufenden Subagents / Tools | agent | **Braucht individuell adressierbare Subagents im Run-Loop (heute Display-Daten); downstream von S5.** | _einbauen_ | **P5** (B · gegated) |
| S7 | Nicht-Datei-Kontext stagen (Git-Diff-Hunk, Editor-Selektion, Terminal-Output) | agent | **Braucht Broker-Capture-Provider für Diff/Selektion/Terminal; existieren NICHT.** Smart-Paste (P4) deckt die Manuell-Variante. | _einbauen_ | **P5** (B · gegated) |
| S8 | Checkpoint-/Branch-Navigation im Composer-Footer | agent | Edit-&-Rerun-as-Branch (P5) deckt 80 % der Retries; baut darauf auf. | _einbauen_ | **P5** |
| S9 | Saved Prompts / Prompt-Templates mit Variablen | both | Teilt das `/`-Overlay (P1); aus Historie wählbar; Save + Re-Run pro Eintrag. | _einbauen_ (Prompt aus einer Historie wählbar, man kann auf Speichern oder auch erneut ausführen klicken) | **P1** |
| S10 | Argument-Hints + Ghost-Text für Slash-Commands | both | `/` (P1) ist ohne voll nutzbar; reine lokale Hints immer an, Token-Variante per Setting. | _einbauen_ (per Setting deaktivierbar, wenn es tokens verbaucht, sonst immer an) | **P1** |
| S11 | MRU-Ranking (recent/frequent) + Persistenz für die Menüs | both | Menüs laufen mit Substring + alphabetisch am Start; MRU ist Feel-Refinement. | _einbauen_ | **P0** |
| S12 | Fuzzy-/Typo-tolerantes Ranking über alle Provider | both | Listen sind kurz; als Engine-Option mit Substring-Fallback bauen, nicht ersetzen. | _einbauen_ | **P0** |
| S13 | Rich Inline-Mention-Rendering (gestylte Pills im Textarea) | both | **Größte Design-Fidelity-Mine:** bricht die `cmp-ta`-Golden + reintroduziert Caret/IME/Paste-Bugs. Plain-`@name` + Chip-Reihe tragen dieselbe Info. | _später_ | **zurückgestellt** (s. u.) |
| S14 | Diktat / Voice-Input | both | Hängt an OS-Speech-Dependency; Auto-Grow/Expand-Politur ist billig und geht zuerst. | _einbauen_ | **P4** |

---

## Phasen-Reihenfolge (Council-Sequenzierung + Triage)

| # | Phase | Gefühlter Effekt | Autonomie | Braucht Dich |
|---|---|---|---|---|
| P0 | Shared-Autocomplete-Overlay-Primitiv (+ MRU/Fuzzy) | — (unsichtbar, trägt alles) | **A (autonom)** | nur Abnahme |
| P1 | `/`-Slash-Commands (+ Arg-Hints, Saved Prompts) | „es kennt alle Commands & meine Templates" | A | nur Abnahme |
| P2 | Multi-Source-`@`-Mentions (Datei/Ordner/Symbol) | „es hängt genau die richtige Datei an" | A / **B (@symbol = LSP)** | LSP-Server für @symbol |
| P3 | Empty-State-Next-Task-Vorschläge (deterministisch) | „die leere Box weiß, was als Nächstes dran ist" | A | Golden-Abnahme |
| P4 | Input-Reliability & -Qualität (History/Drafts/Paste/Diktat + Heuristik-Assists) | „der Input merkt sich was, verliert nichts, hilft schon" | A | nur Abnahme |
| P5 | Agent-Cockpit (Edit-Rerun-Branch, Queue, Checkpoint + **B**: Steering/@subagent/@diff) | „kein Warten mehr — ich iteriere, queue & steuere" | A / **B (echte Run-/Capture-Primitive)** | echter Agent-Run + Runtime-Primitive |
| P6 | Aktive ML-Input-Intelligenz (Ranking/Ghost/Rewrite/Intent) | „der Input denkt mit — aber nur wenn ich's will" | A (hinter Settings) | nur Abnahme |

**Graph:** P0 → P1 → P2 → P3 → P4 → {P5, P6}. P0 ist Fundament (alles mountet
darauf). P1/P2/P4 sind nach P0 grundsätzlich parallel startbar; P3 hängt an P0
(Overlay-Shell) **und** an P4 (Per-Session-Prompt-Log). **P6** (ML-Tier) hängt an
P3 (Kandidaten zum Ranken) + P4 (Heuristik-Legs als Fallback) — die Modell-Schicht
liegt strikt obendrauf. **P5-Tail (S5/S6/S7)** ist gegated auf echte Run-Loop-Inject-
und Broker-Capture-Primitive aus `road-to-actually-works` (P2) / `road-to-real-runtime`.

> **`@symbol`-Naht (Council-Gegenlesen):** `@symbol` (LSP-backed) ist ein
> **eigener, gegateter Slice am Ende von P2** — nicht in `@file` gebündelt. Der
> Code markiert Symbol-Autocomplete explizit als „later phase"
> (`mention-query.ts:8-10`); ohne diese Grenze würde `@file` aufblähen und an
> LSP-Plumbing hängen, das Datei-Mentions nicht brauchen.

> **B-Tail-Gate (S5/S6/S7):** Diese drei sind beschlossen (einbauen), aber **nicht
> baubar, bevor** die Runtime-Primitive stehen — ACP-Inject-Frame (S5),
> adressierbare Subagents (S6), Broker-Capture-Provider für Diff/Selektion/Terminal
> (S7). Sie bleiben in P5 als offene Schritte mit `[B · gegated]`-Marker; ein
> Versuch, sie ohne das Primitiv zu bauen, ist ein Fake — erst das Primitiv, dann
> der Composer-Trigger.

---

## Phase 0 — Shared-Autocomplete-Overlay-Primitiv

**Goal:** `MentionAutocomplete` wird zu **einer** trigger→provider-Engine. Council:
„Die eine Entscheidung, die bestimmt, ob das Ganze sauber oder ein kombinatorisches
Chaos wird." Drei geforkte Autocompletes mit copy-paste-Caret/Keyboard/Overlay sind
genau der Keim des Claude-Code-Bugs „file @-mention bricht nach einem Slash-Command".

- [x] **Ein Token-Detektor** `(text, caret) → {trigger:'@'|'/', query} | null` — **nie** zwei Parser, die denselben Buffer rennen. <!-- done: app/src/lib/mention/token-detector.ts (mention-query.ts unangetastet → dessen Goldens bleiben grün). EIN Left-Walk: `/` ist Body-Char (Pfad `@org/repo`), stoppt nur an `@` oder Boundary; `/`-Command nur am Zeilenanfang. „@-bricht-nach-Slash" + `@org/repo` als Regressionstests (token-detector.test.ts). -->
- [x] **Provider-Registry** `{triggerChar, query→items, renderItem, onSelect}`; Engine besitzt Popup, Substring+Recency-Filter, Arrow/Enter/Tab/Esc, Stale-Handling, Overlay-only-Golden-Disziplin. <!-- done: app/src/lib/autocomplete/{types,engine,filter}.ts — `useAutocompleteEngine` besitzt Token-Dispatch, Items, Highlight, Keyboard (inkl. Tab-Accept neu), Stale-Drop via Generation-Counter, Overlay-only. -->
- [x] **`onSelect` von Navigation entkoppeln:** Engine-`onSelect` ist **reine Insertion**; `openProject()` wird zum **opt-in-Verhalten eines Providers**, nicht Default. <!-- done: `onSelect → {text, caret, sideEffect?}`; Insertion synchron, `sideEffect` (openProject) danach + nie blockierend. Test: Insertion landet auch bei stale/fehlgeschlagener Navigation (MentionAutocomplete.engine.test.tsx). -->
- [x] **`@project` re-mountet** als erster Provider auf der neuen Engine — **kein** Verhaltens-/Pixel-Change; bestehende Mention-Tests + Goldens bleiben grün. <!-- done: makeProjectProvider wrappt matchProjects+insertReference; MentionAutocomplete = Wrap (gleicher Name/Export/DOM byte-identisch). Alle 5 bestehenden MentionAutocomplete-Tests + mention-query-Tests grün; DOM-Struktur-Regressionstest ergänzt. -->
- [x] **MRU-Ranking (S11):** Provider-Items nach Recency+Frequency ranken; leerer Query zeigt Top-Picks zuerst. Greift für alle Provider. <!-- done: `mruScore` auf AutocompleteItem, filterAndRank sortiert MRU-desc; `@project` speist die bereits persistierte `lastSeen`-Ordinal ein. Ein dedizierter Command-MRU-Store (Persistenz für `/`-Commands) folgt mit P1 (kein Command-Provider in P0). -->
- [x] **Fuzzy-/Typo-tolerantes Matching (S12) als Engine-Option:** fzf-artiges Ranking an einer Stelle, alle Provider erben es. <!-- done: filter.ts fuzzyScore + `fuzzy`-Option; Substring bleibt Floor (Fuzzy hebt nie ein Nicht-Substring-Item hervor — Test). `@project` mountet mit fuzzy:false (Default). -->

## Phase 1 — `/`-Slash-Commands (+ Arg-Hints, Saved Prompts)

**Goal:** `/` öffnet inline jede registrierte Action — höchster sichtbarer Wert des
expliziten Wunsches und fast gratis, weil die Registry schon existiert und
self-registriert; dazu Template-/Argument-Komfort obendrauf.

- [ ] **`/`-Provider** liest **dieselbe** `usePalette.registered`-Map wie Cmd-K (eine Quelle der Wahrheit, kein zweiter driftender Katalog); Trigger nur am Zeilen-/Buffer-Anfang; Fuzzy-Filter beim Tippen; Accept → Command **ausführen** (Palette-Stil) **oder** Token einfügen, das der Send-Pfad expandiert. <!-- '/' nur am Start; '@' bleibt mid-word nach Whitespace — beides aus dem einen Tokenizer -->
- [ ] **Mode-aware Filter** (`isChat`-Prädikat, schon durch `Composer` gefädelt): Chat-Modus blendet Tool-/Subagent-/Plan-Mode-Commands + Agent-Mentions aus; Agent-Modus zeigt alles. Dasselbe Prädikat filtert P3-Empty-State + P6 — muss **mit** `/` landen, damit die erste Command-Liste im Chat-Modus nie falsch ist.
- [ ] **Argument-Hints + Ghost-Text für Commands (S10):** nach `/commit` Inline-Arg-Hint `/commit <message>` + 1-Zeilen-Beschreibung; Tab cyclet enumerierbare Arg-Werte. <!-- User-Vorgabe: rein lokale Hints IMMER an; nur eine token-verbrauchende Variante (Modell-Vervollständigung von Arg-Werten) per Setting abschaltbar. -->
- [ ] **Saved Prompts / Prompt-Templates (S9):** wiederverwendbare Prompts mit `{{placeholder}}`, via `/` (teilt das eine Overlay) oder Chevron; **aus einer Historie wählbar**; pro Eintrag **Speichern** und **erneut ausführen** klickbar; „aktuellen Prompt als Template speichern". <!-- User-Vorgabe: Historie-Auswahl + Save/Re-Run-Buttons. Nutzt das P4-Prompt-Log als Historie-Quelle. -->

## Phase 2 — Multi-Source-`@`-Mentions (Datei / Ordner / Symbol)

**Goal:** `@` hängt die **exakte** Datei/Ordner/Symbol an (Claude-Code-`@`-Parität),
sichtbar als entfernbarer Chip mit ehrlichem Security-Tag — über **einen**
bewährten Pfad, nicht über eine neue Ingestion.

- [ ] **`@file` / `@folder`-Provider** aus `ProjectFsProvider.getTree`, Typ-Icon pro Zeile, optionaler `@file:`-Kategorie-Prefix; gleiche Arrow/Enter/Tab/Esc-Keys.
- [ ] **Datei-Pick durch den existierenden Broker-Gate** (`ingest.ts` · `ingestFile`): prod → read-only-Tag, Secret-Form → Refusal-Chip; wird als Kontext-Chip in der `cmp-context`-Reihe angehängt. Ordner-Pick fügt eine Referenz ein. <!-- kein zweiter Ingestion-Pfad -->
- [ ] **Chip ↔ Referenz-Round-Trip:** aufgelöste `@`-Mention spiegelt als entfernbarer Chip; Chip entfernen streicht die Inline-Referenz. `@name`-Text bleibt menschenlesbares Token, Chip ist der Attachment-Handle. Macht das Attachment **legible** statt stiller Anhang.
- [ ] **`@symbol`-Provider (LSP-backed)** als **eigener gegateter Slice am Tail**: Quelle `LspProvider` (`lsp.ts`, completion/hover); Pick fügt `file:line`-Referenz ein; gegated auf LSP-Verfügbarkeit, leer wenn kein Server (Contract-Fallback). Honoriert die „later phase"-Notiz (`mention-query.ts:8-10`) — **nicht** mit `@file` bündeln.

## Phase 3 — Empty-State-Next-Task-Vorschläge (deterministisch)

**Goal:** Die leere/gerade geleerte Box bietet **geerdete, repo-bewusste**
Startpunkte (Capisco kann das, wo Claude Desktop generisch ist) und dient als
Discoverability für `/` und `@`. **Rein deterministisch** — die ML-Rankung ist S1/P6.

- [ ] **3–5 deterministische, mode-gefilterte Vorschlags-Zeilen** in derselben Overlay-Shell, aus **echtem State**: letzte Prompts (Per-Session-Log aus P4), zuletzt editierte/offene Editor-Datei, aktueller Git-Branch/-Diff, letzter fehlgeschlagener Test, offene ToDos (todo-Contract). Klick **füllt** den Composer zum Editieren — **nie** Auto-Send; verschwindet beim Tippen, kommt beim Leeren zurück.
- [ ] **Bewusstes Golden-Update** für den Empty-Input-Snapshot (die leere Box **ist** ein gefangenes Golden) — eigener, deliberater Golden statt versehentlicher Bruch.

## Phase 4 — Input-Reliability & -Qualität (History / Drafts / Paste / Diktat + Heuristik-Assists)

**Goal:** Der Input fühlt sich verlässlich und gelernt an — alles **deterministisch /
heuristisch, kein Modell-Roundtrip**. Die Heuristik-Legs hier sind zugleich der
Fallback, auf den die ML-Schicht (P6) aufsetzt.

- [ ] **Prompt-History-Recall:** bei leerem Composer ↑ läuft rückwärts durch die gesendeten Prompts dieser Session (↓ vorwärts), jeder lädt zum Re-Edit; Prefix/`Cmd+R` öffnet eine durchsuchbare History im Shared-Overlay. Persistiert per Session via vorhandene persist-Middleware. <!-- erzeugt das Per-Session-Prompt-Log, das P3, P1-Saved-Prompts (S9) und P6 konsumieren -->
- [ ] **Draft-Persistenz pro Session:** debounced Autosave des ungesendeten Composer-Bodys, restore bei Tab-Rückkehr/Relaunch, dezente „restored draft"-Affordance + 1-Klick-Clear; getrennt je Chat/Agent-Session (gleiche persist-Slice wie backend/terse-Prefs).
- [ ] **Smart-Paste-Heuristiken:** Paste prüft Clipboard billig (URL-Regex, MIME, Länge): bare URL → „fetch & attach"-Chip, Bild → Attachment-Chip, Paste > ~N Zeilen → „collapse into context chip" statt Textarea-Flut — alles durch den **existierenden** `ingestFile`-Gate (prod/secret-Regeln greifen); Raw-Paste-as-Text bleibt 1 Klick entfernt.
- [ ] **Textarea-Auto-Grow + Expand-to-Fullscreen + Diktat (S14):** Auto-Grow + Expand-Toggle (billig, deterministisch, golden-bewusst) zuerst; danach Mic-Button (Push-to-Talk) fügt OS-transkribierten Text am Caret ein. <!-- User-Vorgabe einbauen. Diktat hängt an OS-Speech-Dependency → eigener Commit nach dem Auto-Grow/Expand-Teil. -->
- [ ] **History-gestütztes Ghost-Text (S2 · Heuristik-Leg):** graue Inline-Completion des wahrscheinlich nächsten Prompts **nur aus dem Per-Session-Prompt-Log** (kein Modell, deterministisch); Tab/→ akzeptiert; rendert nur auf Tipp-Transition (Golden-Disziplin). <!-- Modell-gestützte Fortsetzung = P6. -->
- [ ] **Heuristik-Prompt-Lints (S3 · Heuristik-Leg):** deterministische, verwerfbare Hinweise (vager Ask, keine Akzeptanzkriterien, fehlende Datei-Referenz) — **kein** Modell-Roundtrip. <!-- Modell-Rewrite „improve this prompt" = P6. -->

## Phase 5 — Agent-Cockpit-Control-Flow

**Goal:** Agent-Modus zwingt nicht mehr zu warten-oder-unterbrechen — der Composer
wird zum Cockpit für den Branching-Baum, den die Contracts schon modellieren. Die
ersten drei Schritte sind **A** (Primitive existieren); die `[B · gegated]`-Schritte
sind beschlossen, aber **erst baubar, wenn das jeweilige Runtime-Primitiv steht**.

- [ ] **Edit-&-Rerun-last-prompt-as-branch:** „edit last" / ↑-auf-leer repopuliert den vorigen User-Turn; Senden ruft das **existierende** `SessionTree.branch()` (`session-store.ts:7-8,105` — Retry forkt ein Sibling, überschreibt nie), Label z. B. „retry · edited".
- [ ] **Message-Queue während ein Run läuft:** bei laufender Session hängt `Cmd+Enter` die Nachricht an eine sichtbare Per-Session-Queue (Chips unter dem Composer), die in Reihenfolge auf das vorhandene `subscribe('done')`-Event drainiert; jedes Item editier-/entfern-/umsortierbar vor dem Feuern; leere Queue unsichtbar. <!-- hängt nur an vorhandenen Run-State-Events + onStop, keine neue ACP-Injection -->
- [ ] **Checkpoint-/Branch-Navigation (S8):** „Checkpoint" benennt den aktuellen `SessionTree`-Leaf; kompakter Branch-Switcher springt zwischen divergenten Prompt-Linien. Baut auf Edit-&-Rerun-Branch auf.
- [ ] **[B · gegated] `@diff` / `@selection` / `@terminal` stagen (S7):** Git-Diff-Hunk, Editor-Selektion, Terminal-Output als Chips durch den Broker-Gate, damit „fix the failing test" mit Diff + Terminal-Output vorgestaged landet. <!-- BLOCKIERT: braucht Broker-Capture-Provider für diff/selection/terminal — existieren NICHT (road-to-real-runtime). Bis dahin deckt Smart-Paste (P4) die Manuell-Variante. Erst Capture-Provider, dann dieser Schritt. -->
- [ ] **[B · gegated] Mid-Run-Steering (S5):** „Steer"-Affordance injiziert eine **weiche Leitlinie** in den laufenden Run (≠ hartes Stop, ≠ after-run Queue), sichtbar als User-Steer-Block im Transkript. <!-- BLOCKIERT: braucht echtes ACP/Run-Loop-Inject-Frame; Mock liefert nur Run-State-Signale (road-to-actually-works P2 / road-to-real-runtime). -->
- [ ] **[B · gegated] `@`-Mention laufender Subagent/Tool (S6):** `@` listet Live-Subagents/Tool-Actions, sodass „redo @subagent:tests with vitest" den nächsten Turn auf diesen Zweig scopt. <!-- BLOCKIERT: braucht individuell adressierbare/steuerbare Subagents im Run-Loop (heute Display-Daten) + downstream von S5 (Steering). -->

## Phase 6 — Aktive ML-Input-Intelligenz (per Setting, token-bewusst)

**Goal:** Die Modell-gestützten Assists obendrauf — **jeder mit deterministischem/
heuristischem Fallback aus P3/P4, jeder per Setting abschaltbar, keiner feuert still
auf einem heißen Idle-Pfad**. Querschnitt: rendern nur auf State-Transition, dürfen
Goldens nicht brechen. (Council-Tier „ML muss sich verdienen" — Matze: einbauen.)

- [ ] **ML-gerankte Empty-State-Vorschläge (S1):** Modell rankt/ergänzt die **deterministischen P3-Kandidaten**; P3-Variante bleibt **Default-Fallback**; per Setting an/aus. <!-- User-Vorgabe: per Setting deaktivierbar. Token-bewusst: nur on-demand/explizit, nicht bei jedem Leeren des Felds. -->
- [ ] **Modell-gestütztes Ghost-Text (S2 · Modell-Leg):** Fortsetzung über den History-Heuristik-Leg (P4) hinaus via Low-Latency-Streaming; per Setting; rendert golden-sicher (nur auf Transition); Heuristik bleibt, wenn aus.
- [ ] **Prompt-Rewrite „improve this prompt" (S3 · Modell-Leg):** Entwurf → günstiges Modell → getighteter Rewrite als **Accept/Reject-Diff-Preview**; **nie automatisch**, ein Roundtrip pro expliziter Anforderung; per Setting.
- [ ] **Intent-Auto-Detect (S4):** Klassifikator nudged „sieht nach Task aus — Agent-Modus?" — **nie Auto-Switch**; per Setting deaktivierbar. <!-- User-Vorgabe: per Setting deaktivierbar. Nicht-nerviger Schwellenwert; Default ggf. aus, bis History echten Mode-Mismatch zeigt. -->

---

## Bewusst zurückgestellt (später)

- **S13 — Rich Inline-Mention-Rendering (gestylte Pills im Textarea).** _Entscheidung: später._
  Größte Design-Fidelity-Mine: ein contenteditable/Overlay-Editor bricht die
  `cmp-ta`-Golden und reintroduziert Caret/IME/Paste-Bugs, die das Plain-Textarea
  vermeidet. Plain-`@name`-Token + die Chip-Reihe (P2) tragen dieselbe Information.
  Re-evaluieren, wenn die Pixel-1:1-Bindung gelockert wird oder der Prototyp selbst
  Pills bekommt. Bis dahin **kein** Bau (Querschnitts-Invariante Design-Fidelity).

---

## Akzeptanzkriterien

- **P0:** ein Tokenizer für `@`+`/`; `@project` unverändert (Goldens grün); MRU ordnet Top-Picks vor; Fuzzy ist zuschaltbar mit Substring-Fallback; der „@-bricht-nach-Slash"-Bug ist strukturell unmöglich (Regressionstest).
- **P1:** `/` listet jeden registrierten Command (gleiche Quelle wie Cmd-K), Tastatur-Nav vollständig, mode-korrekt im Chat; Arg-Hints lokal immer an; Saved Prompts aus Historie wählbar + Save/Re-Run.
- **P2:** `@file` hängt die exakte Datei als broker-getaggten, entfernbaren Chip an; prod-read-only + Secret-Refusal sichtbar; `@symbol` leer-aber-stabil ohne LSP.
- **P3:** leere Box zeigt repo-bewusste **deterministische** Vorschläge, Klick füllt (nie sendet); Empty-Golden bewusst aktualisiert.
- **P4:** ↑ holt vorige Prompts; Entwurf überlebt Tab-Wechsel/Relaunch; 600-Zeilen-Paste wird Chip statt Textarea-Flut (Budget-Meter bleibt ehrlich); Textarea wächst/expandiert; Diktat fügt Text am Caret ein; History-Ghost-Text + Heuristik-Lints rendern nur auf Transition.
- **P5:** Edit-&-Rerun erzeugt ein Branch-Sibling (nicht-destruktiv); Queue drainiert in Reihenfolge auf `done`; Checkpoint/Branch-Switcher springt. **S5/S6/S7 gelten erst als baubar, wenn ihr Runtime-Primitiv (ACP-Inject / adressierbare Subagents / Capture-Provider) existiert — vorher offen lassen, NICHT faken.**
- **P6:** jeder ML-Assist hat einen deterministischen Fallback, ist per Setting abschaltbar, feuert nie still auf Idle; mit Setting=aus verhält sich der Composer exakt wie nach P4.
- **Querschnitt:** alle Overlays rendern nur auf State-Transition; `cmp-ta` bleibt pixel-1:1; manuelle Real-Abnahme in Chat **und** Agent-Modus.
