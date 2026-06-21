# Capisco IDE — Chatverlauf / Build-Changelog

Ein chronologisches Protokoll der gesamten Zusammenarbeit an der Capisco Design System
und dem IDE-UI-Kit. Pro Eintrag: die Anforderung (User) und die Umsetzung (Claude).
Verbatim-Nachrichten früherer Phasen wurden teils zusammengefasst.

---

## Phase 0 — Setup & Design System

**User:** Design System für „capisco" anlegen.
**Claude:** Projekt als leeres Verzeichnis vorgefunden, Rückfragen gestellt.

**User:** Detailliertes Design-Brief geliefert — Capisco ist eine *agent-native Desktop-IDE*
(Dark Theme, JetBrains New UI / PhpStorm-Dark Ästhetik). Vollständige Layout-, Farb- und
Typografie-Spezifikation.
**Claude:**
- Token-CSS geschrieben: `tokens/colors.css` (Dark canonical + `[data-theme=light]`),
  `syntax.css`, `typography.css`, `spacing.css`, `motion.css`, `fonts.css`.
- Root `styles.css` als reine `@import`-Liste.
- Komponenten: `core/` (Button, IconButton, Input), `indicators/` (StatusDot, ModelBadge,
  GitMarker), `ide/` (EditorTab, TreeRow, ToolAction, PermissionPrompt) — je `.jsx`, `.d.ts`,
  `.prompt.md`.
- Foundation-Specimen-Cards (Colors, Type, Spacing, Brand) für den Design-System-Tab.
- Logo-Platzhalter (Session-Tree-Mark), `readme.md`, `SKILL.md`.

---

## Phase 1 — IDE Hero-Screen

**User:** (Brief) Hauptarbeitsfenster der IDE als hochauflösendes Mockup.
**Claude:** UI-Kit `ui_kits/capisco-ide/` gebaut — Titelleiste, zwei Activity-Bars,
Datei-Explorer, Editor mit Syntax-Highlighting + Rainbow-Brackets + Autocomplete, Terminal,
Agent-/Session-Tree-Panel, Statusleiste. Dark/Light-Toggle. Offline-Fallback-Shim für die
Komponenten.

---

## Phase 2 — Agent-First Redesign

**User:** Code-Fenster ist nicht mehr so wichtig. Links Explorer behalten, untere Hälfte
Work Stash. Mitte = umschaltbar zwischen Editor und Agents (Toggle ganz rechts). Rechts nur
noch Button-Leiste. Alerts/Inspect als Flyouts. Agent-Chat wird zentral.
**Claude:** Layout komplett umgebaut — zentraler Workspace mit Editor⇄Agents-Toggle (rechte
Rail), Work Stash unter Explorer, rechtes Panel entfernt, Alerts/Inspect als pinbare Flyouts.

---

## Phase 3 — Iterationen am Workspace

- **Splitter** zwischen Workspace und Terminal (dicker, ziehbar zum Resizen).
- **Linke Rail** toggelt Panel-Ansicht (Explorer ⇄ Commit) statt Stapelung.
- **Agent-Backend-Settings** (Zahnrad): API-Client (Token) vs. installierte CLI.
- **ToolAction → „open in editor"**-Icon.
- **Composer = nur Modellauswahl**; „+" wählt zuerst den Agent (Claude/GPT/…).
- **Composer-Leiste unten** (Claude-Desktop-Stil): Modell · Reasoning-Effort (Slider
  Faster↔Smarter) · Budget-Ring mit Plan-Usage-Popover.

---

## Phase 4 — Alle Ansichten (aus dem Konzept)

**User:** Konzept-Dokument geliefert; „baue alle Ansichten ein".
**Claude:** Linke Tools ergänzt — **PR/Forge-Board** („whose turn"), **Git-Dashboard**
(local-first), **Search** (ripgrep), **Structure** (Symbol-Outline), **Data** (Datasource,
prod read-only). Danach: **Diff-View** (Split/Unified), **Services** (Docker/Container),
**Task-Board** (Jira/Linear).

---

## Phase 5 — Teammate-Kommentare (Matze)

- Terminal-Toggle unten in der linken Rail.
- Drag-to-dock in den unteren Bereich.
- Höheres, mehrzeiliges Commit-Feld.
- Flyout-Close-„×" entfernt (nur Pin bleibt).
- Tabs per „×" schließbar.

---

## Phase 6 — Git-Dashboard (PR-zentriert)

**User:** Git-Ansicht soll nicht nur eigene Aktivität zeigen.
**Claude:** Primär-Tabs **My PRs**, **Review Requested** (Re-Reviews hervorgehoben),
**Overdue** (>3 Tage ready). Aktivität/Overview/Working-Times als Sekundär-Tabs. GitHub-artige
PR-Detailzeilen (Status, Checks, Reviewer-Avatare, Labels, +/−).
- Header „Git Dashboard".
- **Filter auf allen Tabs** + **Custom**-Dropdown (Presets + From–To-Range).
- **Working Times**-Heatmap (7×24h): Kernzeiten grün, Off-Hours/Wochenende rot,
  einstellbare Arbeitszeit (Default 09:00–17:00, Ende bis 24:00).
- **Team**-Tab (git.live-Stil): wer arbeitet woran, By PR / By branch, Overlap-Warnung,
  Cherry-pick.

---

## Phase 7 — Editor-Erweiterungen

- **Inlay-Hints**: Parameter-Namen vor Argumenten.
- **Inline-Blame** auf der aktiven Zeile (Autor · Datum · Commit).
- **Live-Presence** (git.live): Avatar im Gutter auf Kollegen-Zeilen → Popup mit Diff +
  „Cherry-pick this block". Popup wächst mit Inhalt bis 80% Editor-Breite.
- **Social-Lane** links der Zeilennummern: Avatar ganz links, Teal-Balken in eigener Spur,
  exakt über den betroffenen Zeilen.

---

## Phase 8 — Changes-Tool

**User:** Icon „Changes" — Diff gegen Parent/Target-Branch, jeder Branch wählbar.
**Claude:** Changes-Panel mit Branch-Vergleich. Default: Target-Branch wenn PR existiert,
sonst Parent (abgebrancht-von). Andere Branches per Such-Dropdown.

---

## Phase 9 — Services nach Projekt

**User:** Services in Projekte unterteilen, nur geladene Projekte.
**Claude:** Services nach `capisco-core` / `capisco-tauri` gruppiert, collapsible Header mit
Running-Count. Dunkle, sticky Gruppen-Header (wie später auch im Projekt-Explorer).

---

## Phase 10 — Tasks-Workspace (Jira/Linear)

**User:** Allgemeines Dashboard mit Tickets, eigene Tickets, aktive Arbeit, Sprint- und
privater Burndown.
**Claude:** Tasks-Workspace (rechte Rail neben Git) mit Tabs **Board**, **My Tickets**,
**Active** (In Progress/Review/Testing), **Insights/Burndown** (Sprint + privat, ideal vs.
actual). Spalten-Listenansicht konsistent über Tabs, volle Breite.
- Ticket-Klick öffnet eigenen **Ticket-Tab** (Beschreibung/Kommentare bearbeitbar,
  schließbar per „×"); Haupt-Tab = Übersicht.
- Button „Branch erstellen", im Stil statt weiß.

---

## Phase 11 — Tool-Window-Dock (Drag & Drop)

**User:** Icons frei zwischen linker/rechter/unterer Leiste verschiebbar; Flyout öffnet auf
der Seite des Icons; oben/unten teilt das Fenster.
**Claude (iterativ, mehrere Korrekturen):**
- Icons per Drag in **linke Rail**, **rechte Rail** und **unteren Bereich** verschiebbar.
- Linke Rail: **Top-Gruppe** und **Bottom-Gruppe** um das Terminal-Icon; aktive Tools in
  beiden Gruppen → **linkes Panel vertikal geteilt** (oben/unten, ziehbarer Divider).
- Top/Bottom als **echte Gruppen** (Region folgt Gruppenzugehörigkeit, nicht der
  Terminal-Position) — Fix: Tool bleibt unten, auch wenn Terminal darunter gezogen wird.
- **Rechte Rail** gespiegelt: Top-/Bottom-Gruppe, eigene Bottom-Drop-Zone, vertikaler Split
  im rechten Panel.
- **Bottom-Drop-Zone**: gestrichelter, icon-großer Platzhalter nur wenn leer; verschwindet
  sobald ein Tool drin ist.

---

## Phase 12 — shadcn-Variante

**User:** React-Frontend mit shadcn; Tailwind via CDN; produktionsreife shadcn-Quelle.
**Claude:** `_shadcn/`-Quellen im shadcn/Radix-Idiom (Varianten, Slots, Props) angelegt,
Capisco-Dark-Look beibehalten.

---

## Phase 13 — Handoff

**User:** Alles als kopierbares MD für Claude Code.
**Claude:** `ui_kits/capisco-ide/HANDOFF.md` — vollständige Build-Spec (Was/Ansichten/
Verhalten/Design/Entscheidungen/Komponenten-Inventar).

**User:** Gesamten Chatverlauf als MD-Datei.
**Claude:** Dieses Dokument (`CHATLOG.md`).

---

## Design-Entscheidungen (Querschnitt)

- **Dark canonical**, Flächen über Helligkeit getrennt (Editor `#1E1F22`, Tool `#2B2D30`,
  Raised `#1C1D20`), genau **ein Akzent: Teal `#3FB6A8`**, sparsam.
- **Inter** (Chrome 11–14px) + **JetBrains Mono** (Code/Terminal 13px/1.5). Caps-Labels
  11px getrackt grau. Metadaten immer mono + grau.
- Dichte 4/8/12-Raster; Ecken nahezu eckig (0/3/5px); **keine** Verläufe/großen Schatten
  (nur ein Popup-Shadow); keine SaaS-Cards.
- **Lucide**-Icons, linear, monochrom; Teal nur im aktiven Zustand. Keine Emoji im UI.
- Sprache terse, lowercase-Produktname, neutral — auch bei destruktiven Prompts (Broker).
- Motion 0.12–0.18s ease; einzige Loops: Running-Status-Puls, Terminal-Caret;
  `prefers-reduced-motion` respektiert.
