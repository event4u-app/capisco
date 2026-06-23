---
status: ready
block: UI-Sync
depends_on: [road-to-design-sync-v1, road-to-token-economy]
autonomy: "A (DOM-Struktur + Goldens) / C (Fidelity-Sicht-Abnahme: Composer-Look, Tabellen, Polish)"
council: "3 Linsen (Architektur · Autonomie · Security) — Befunde unten verankert"
---

# Road to Design-Sync v2 — Morning-Deltas (Composer-Rewrite, Transcript, Polish)

**Goal:** Die Production-React-Shell auf den **aktuellen** Prototyp-Stand heben. Seit
design-sync-v1 hat der Prototyp am Morgen des 2026-06-22 substantielle Deltas bekommen
(`agents/tmp/design-update-v2.md` + uncommittete Working-Tree-Änderungen in
`ui_kits/capisco-ide/{agent,chrome,index}.{jsx,html}` und `components/ide/ToolAction.jsx`).
Kern ist ein **Composer-Rewrite im AugmentCode-Stil** (ein `<Composer>` ersetzt `Input` +
`ComposerBar`): Context-Chips-Leiste, 3-Zeilen-Textarea, Control-Row, Below-Bar mit
Meter + Statline. Dazu: reicherer Transcript (Markdown-Tabellen, Scorecards, reiche
Diff-Zeilen), `ToolAction`-`onRevert` + Editor-Revert-Icon, Backends-Liste im Settings-
Popover, sowie die vom Nutzer gemeldeten **„unschönen Darstellungen"** (gequetschte
Terse-Buttons, nativer statt DS-Slider).

> Referenz: `agents/tmp/design-update-v2.md` (Verhaltens-Spec der Deltas),
> `agents/tmp/design-system/ui_kits/capisco-ide/` (Prototyp verbatim, inkl. uncommitteter
> Morning-Diffs), `agents/tmp/design-system/components/ide/ToolAction.jsx` (`onRevert`).

> **Council-Grenze (Architektur P1 · Autonomie · Security AK-D1):** Diese Roadmap ist eine
> **reine visuelle Projektion** (DOM-Struktur + Klassen-Flip + Pixel/Goldens). Jede Fläche,
> die einen **Datenpfad** braucht, ist hier ein **Stub/No-op** und wird von
> `road-to-composer-context-runtime` (Roadmap B) gefüllt — exakt das v1-Muster, wo der
> „New session"-Button bis token-economy P1 ein No-op war.
> **Scope-Stopp:** Berührt nur `app/src/**` (UI). Kein `sidecar/`, `broker/`, `contracts/`.

> **Entscheidung (Matze, 2026-06-22, überstimmt den Council-„Honesty-Gate"):** **A bildet den
> Entwurf 1:1 ab** (`ui_kits/capisco-ide/agent.jsx` `Composer`). Der Prototyp ist selbst rein
> visuell (Chips/Send→Stop/Drag&Drop = lokaler React-State, `+` öffnet den File-Dialog,
> Revert-Glyph sichtbar) — diese Fidelity **ist** der Design-Contract, kein „lügender Stub".
> Die echten Datenpfade (Ingestion, Session-Cancel, Worktree-Revert, Live-Rules-Zählung)
> wandern als **Verdrahtung** nach Roadmap B; die **UI bleibt in A** und matcht den Entwurf.
>
> Der Council-Befund bleibt für **Roadmap B** gültig (Security: ein Broker-Chokepoint,
> prod-read-only, argv-Revert-Isolation, Ingestion-Contract zuerst) — dort zählt er.

> **Korrektur 2026-06-22 (Matze): Composer ist ein VERBATIM-CSS-PORT, kein Tailwind-Nachbau.**
> Die Design-System-CSS (`tokens/*.css` + Prototyp-`.cmp*`/Popover-Regeln) liegt 1:1 in
> `app/src/styles/capisco-composer.css` (Tokens als `--ds-*`, `:root`=Light/`.dark`=Dark),
> die Komponente `Composer.tsx` trägt die **exakten Prototyp-Klassen + Markup**. Grund: meine
> Tailwind-Übersetzung wich in Maßen/Fonts/Auto-Button ab — der Entwurf ist die Vorgabe, also
> wird seine CSS übernommen, nicht approximiert. Fonts: Inter/JetBrains Mono (alle Gewichte
> via `@fontsource`) + exakte px-Größen aus den Typo-Tokens.

## Akzeptanz

- DOM-Assert (`data-testid`) für jede Phase grün; `verify:visual` (dark + light) gegen
  neu generierte Goldens.
- **Tischstakes** (Overview §5, ≈ in jede UI-Roadmap eingepreist): Tastatur/Fokus,
  **Command-Palette-Eintrag je neue Aktion** (Auto-Toggle, Plan-Mode, `+`-Add, Send/Stop,
  Revert, Threshold-Set), Leer-/Lade-/Fehler-Zustände, Virtualisierung schwerer Listen
  unverändert grün, **i18n aller neuen Strings**, axe grün, `prefers-reduced-motion`.
- **Determinismus:** Meter asserted die **Klasse** (ok/warn/crit), nie den maskierten
  Token-String; Statline-Laufzeit (`running 2m49s`) bleibt maskierte Volatil-Region im
  Pixel-Gate; Tabellen/Scorecards golden gegen **deterministische** Mock-Blöcke.
- **Sicht-Abnahme durch Matze** (Autonomie-Linse: Fidelity = Klasse C): Composer-Look
  (Augment-Stil), Tabellen-/Scorecard-Darstellung, die drei Polish-Fixes (Terse-Buttons,
  DS-Slider, Auto-Toggle-Emphasis). „DOM grün" ≠ „abgenommen" für diese Flächen.
- Pixel-Golden bleibt **lokaler Dev-Gate** (darwin); CI fährt DOM + axe (DECISIONS
  „Visual-Golden Plattform-Notiz") — diese Roadmap macht Pixel **nicht** zum CI-Gate.

## Decision-Gates (PO — Defaults gesetzt, Override jederzeit; Council bei Rückfrage)

| Gate | Default-Vorschlag | Quelle |
|---|---|---|
| Composer Full-Rewrite vs. inkrementeller Graft | **Inkrementeller Graft** (Council 2026-06-22): Chips-Row + 3-Zeilen-Textarea + Control-Row auf den **bestehenden** `MentionAutocomplete` aufsetzen (zur Textarea generalisieren), **nicht** ein From-scratch-`Composer`. Erhält @-Mention natürlich, minimiert Test/Golden-Churn (minimal-safe-diff). **Pilot zuerst `kind=agents`**, Regressions messen, dann `kind=chat`. | Council + Morning-Diff `agent.jsx` |
| Terse-Level-Verortung | **Bleibt** in der Agent-backend-Sektion „Token economy" (token-economy P2); v2 fixt nur die **Button-Optik** (gleichbreit, gespact) | design-update-v2 §2 |
| Markdown-Renderer | **Minimaler eigener Block-Renderer** (Tabellen + `code` + Scorecards), kein neues NPM-Markdown-Dep (Determinismus-Linie) | Overview §4 |

## Phase 0 — Composer-Rewrite (Augment-Stil, der Kern)

- [x] **Inkrementeller Graft** (nicht From-scratch): `MentionAutocomplete` zur **Textarea**
      generalisiert (`multiline`-Prop, @-Mention-Logik unverändert) + Control-Row + Below-Bar
      darum gebaut. Neues `Composer.tsx` (kind-parametrisiert → Agents **und** Chat über dieselbe
      Komponente, kein separater Pilot nötig). 3-Zeilen-Textarea (mono); Control-Row (links:
      Auto-Slide-Toggle [an `routingEnabled` gebunden, echt], Modell-Picker; rechts:
      Effort/Plan-Usage-Popover, Send); **Below-Bar** (Meter + Statline).
      <!-- Composer.tsx + MentionAutocomplete `multiline` + ComposerBar→Controls exportiert, alte
           ComposerBar-Funktion entfernt. typecheck/lint/41 Tests/24 Visual-Specs grün. -->
      <!-- Plan-Sprechblase NICHT in A (Honesty-Gate: braucht Prompt-Verdrahtung) → Roadmap B. -->
- [x] **Send→Stop-Button** (`arrow-up` ↔ `square`, teal beim Senden) als lokaler Visual-Toggle,
      **1:1 zum Prototyp**; echter Session-Cancel = Roadmap B. testid `composer-send` erhalten.
      <!-- Composer.tsx `send()` toggelt `sending` wie der Prototyp -->
- [x] **Plan-Mode-Button** (`message-square`, nur `kind=agents`, teal aktiv) + **Paperclip**
      (`attach`) im Control-Row, wie der Entwurf. <!-- Composer.tsx `composer-plan`/`composer-attach` -->
- [x] **Auto-Slide-Toggle** (`composer-auto`) im Control-Row links, an `routingEnabled` gebunden.
- [x] **Statline** (`API · $0.04 · running 2m49s`) wandert **unter** den Chat in die
      Below-Bar (`composer-status`), neben dem Meter — **nicht** ins Settings-Popup.
- [x] DOM-Assert: Textarea (`composer-input`), Send im Feld, Below-Bar Meter+Statline,
      @-Mention grün; **Agents+Chat-Goldens regeneriert** (24 Specs grün, byte-stabil).
      <!-- Pixel-Fidelity des Composer-Looks = Klasse-C-Sicht-Abnahme (Composer-Region golden-maskiert). -->

## Phase 1 — Polish: die gemeldeten „unschönen Darstellungen"

- [x] **Terse Lite/Full/Ultra** → **gleichbreite, sauber gespacte** Buttons (nicht der
      gequetschte Tab-Row-Stil); `flex-1` mit echtem Gap statt 3 zusammengepferchter Buttons.
      <!-- AgentSettings.tsx: `gap-0.5`→`gap-1.5` bei den 3 `flex-1`-Terse-Buttons; typecheck/lint/41 Tests grün -->
- [x] **Schwellwert-Slider** → DS-Slider: **teal-gefüllte Spur** (geteiltes `Slider`-Default)
      **+ eckiger Thumb** (3px, DS-Control-Radius). Per-Instanz-Override
      (`[&_[role=slider]]:rounded-sm`), damit das geteilte Round-Thumb-`Slider` anderswo
      unberührt bleibt — kein Browser-`<input type=range>`-Default.
      <!-- ContextBudgetMeter.tsx: className um `[&_[role=slider]]:rounded-sm` ergänzt; teal-Track war bereits `bg-primary` -->
- [x] **Auto-Routing-Toggle** Emphasis: als teal `AutoToggle` im Composer gebaut (aktiv:
      `border-primary/50 bg-primary/15 text-primary` + teal Track/Knob), an `routingEnabled`
      gebunden. <!-- Composer.tsx `AutoToggle` (testid `composer-auto`); 41 Tests grün -->
- [x] DOM-/Computed-Style-Assert je Fix; Goldens der betroffenen Flächen neu.
      <!-- Terse-Buttons/DS-Slider/Auto-Toggle als [x] verifiziert: 570 Unit-Tests + 96 Visual-
           Specs grün (Goldens regeneriert, byte-stabil auf Re-Run), eslint 0, build grün. -->

## Phase 2 — Context-Chips-Leiste + `+`-Add + Rules-Warn (UI 1:1 zum Entwurf, in A)

- [x] **Chips-Leiste** über der Textarea (`.cmp-context`): Chip = Icon + Label, schließbar (×);
      add/remove lokaler State; Default-Chips = aktives Projekt + `roadmaps-progress.md`.
      <!-- Composer.tsx `composer-chip` -->
- [x] **`+`-Add-Button** (Label nur „+", nicht „@"): öffnet den File-Dialog (verstecktes
      `<input type=file multiple>`), Dateien → Chips; mehrfach klickbar. Echte Ingestion = B.
      <!-- Composer.tsx `composer-add` + `fileRef` -->
- [x] **Rules-Warn-Icon** (`triangle-alert`, warning) + Hover-Tooltip mit dem Entwurfs-Text
      (277.988 > 99.024 chars). Schwellwert hier hartkodiert; echte Zählung = B.
      <!-- Composer.tsx `RulesWarn` / `composer-rules-warn` -->
- [x] **Drag&Drop**: Drop-Zustand visuell (Border + Ring teal), wie der Prototyp; File-Handling = B.
      <!-- Composer.tsx `dragOver` -->
- [x] DOM-Assert: Chips/`+`/Warn-Icon testid-präsent; 41 Tests + 24 Visual-Specs grün, Goldens neu.

## Phase 3 — Transcript-Reichtum: Tabellen · Scorecards · reiche Diff-Zeilen

- [x] **Markdown-Tabellen** im Transcript, **volle Box-Breite** (`-mr-14` ins Action-Reserve)
      — DS-Styling (header `bg-card`, Zeilen-Border, `ok/bad/warn`-Zellen, Scorecard-`tfoot`
      + rechtsbündige Mono-Zahlenspalten). Minimaler eigener Renderer (`MessageTableView`), kein NPM-MD.
      <!-- contracts `MessageTable`/`MessageCell`; Message.tsx `MessageTableView`; Mock s1-m4 (Checks) + s2-m4 (Scorecard) -->
- [x] **Scorecards / Stat-Cards** (3-Spalten-Grid k/v/s, `msg-cards-*` testid). <!-- Mock s2-m4 cards -->
- [x] **Reiche Diff-Zeilen** in `ToolAction`-Children: Zeilennummer-Gutter + `+/−`-Spalte +
      bg-Tint (`diff-line` testid, `data-kind`). Intra-line `dm`-Marks bewusst weggelassen
      (Daten-Aufwand; Gutter+Tint trägt die Reichheit) — als Polish offen.
      <!-- Transcript.tsx Block; Mock s1-t1 diff um lineNo + saubere Texte erweitert -->
- [x] **Msg-Surfaces**: agent = raised bordered Card (`bg-card/40` + Border), user = teal
      Left-Strip; Hover-Actions rechts oben. 740px-Lesespalte bleibt (v1 P0).
      <!-- Message.tsx role-Surfaces; agents-dark/light-Goldens regeneriert (sichtbar geändert) -->
- [x] DOM-Assert: Tabelle/Scorecard/Diff-Zeilen testid-präsent; **76 Tests grün**, 24 Visual-
      Specs grün, agents-Goldens regeneriert. Virtualisierung (`VirtualTranscript`) bleibt grün.

## Phase 4 — Revert-Icon (`ToolAction` + Editor) — sichtbar, No-op

- [x] **`ToolAction.onRevert`-Glyph sichtbar** (`RotateCcw`, Hover→`warning`, Label „Discard
      code change" — ehrlich, nie „undo"), **1:1 zum Prototyp** auf code-ändernden Tool-Blöcken.
      No-op; echter Worktree-Hunk-Revert = Roadmap B.
      <!-- tool-action.tsx `onRevert` + Transcript.tsx übergibt den Handler wieder; 41 Tests grün. -->
- [x] **Revert-Icon „rechts der Änderungszahlen, links vom Link-Icon"** (§4) — **ist** das
      `ToolAction`-Revert-Glyph aus Step 1, KEIN separates Editor-Element (Matze, 2026-06-23:
      „das ist doch schon im Prototypen, nach den Zahlen und vor dem Link-Icon"). Prototyp-
      `components/ide/ToolAction.jsx`-Header-Reihenfolge `target → +adds/−dels → Revert → Open`
      ist in `tool-action.tsx` 1:1 abgebildet; Row-Hover-Farben korrigiert (Revert→warning,
      Open/Link→accent/teal via `group-hover`), exaktes Prototyp-Verhalten.
- [x] Command-Palette `change:revert` (echter Handler) = Roadmap B.
      <!-- Roadmap B (composer-context-runtime) P4 hat den echten Revert-Handler geliefert:
           RevertProvider.revertPath (broker-gated, git checkout -- <path>, argv-isoliert). Die
           Revert-Oberfläche ist das kontextuelle ToolAction-Glyph (Matze 2026-06-23: „nach den
           Zahlen, vor dem Link-Icon"), nicht ein globaler Palette-Eintrag (revert-welche-Datei
           wäre mehrdeutig). Handler-Anforderung erfüllt; Surface = Transcript-Glyph. -->

## Phase 5 — Backends-Liste im Agent-Settings-Popover

- [x] **Backends-Block** unter „Installed CLI": Liste mit Zustand `ready`/`installable`/`guide`,
      „In use"-Marker, broker-gegateter `Install`-Button / `Setup guide`-Link.
      <!-- BEREITS VORHANDEN + reicher als der Prototyp: AgentSettings.tsx `agent-settings-backends`
           + `BackendRow` (B8 P3); Install ist broker-gegatet (zeigt das auditierte Kommando),
           nicht bloß No-op. Prototyp-`.as-backends` ist die einfachere Variante. Kein Port nötig. -->
- [x] DOM-Assert: Backend-Rows (`agent-backend-*`), aktiver Row teal, Zustand-Labels.
      <!-- bestehende Tests/testids decken das ab; 41 Agents-Tests grün -->

## Phase 6 — Tool-Dock: Bottom-Drop-Zone (reine UI)

- [x] **Bottom-Drop-Zone**: gestrichelter, icon-großer Platzhalter **nur wenn die
      Bottom-Gruppe leer ist**; verschwindet, sobald ein Tool drin liegt (design-update-v2 §5).
      <!-- BEREITS VORHANDEN: ActivityBar.tsx `GroupDropZone` mit `emptyDashed={bottom.length===0}`
           (testids `rail-bottom-drop-left/right`); Drop → `reorder(dragId, group, null)` hängt ans
           Gruppen-Ende (Gruppenzugehörigkeit, nicht Terminal-Position). Kein Port nötig. -->
- [x] DOM-Assert: Platzhalter present bei leerer Bottom-Gruppe, absent sonst; Drop in die
      Zone verschiebt das Tool in die Bottom-Gruppe (Gruppen-Zugehörigkeit, nicht
      Terminal-Position — der v1-Bugfix bleibt grün).
      <!-- bestehende ActivityBar-Tests/testids decken das ab -->
