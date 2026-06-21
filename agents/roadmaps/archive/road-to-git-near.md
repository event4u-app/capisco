---
status: complete
block: Git-Nähe
depends_on: [road-to-chrome-shell]
unlocks: [road-to-dashboards-boards]
---

# Road to Git-Near (R4)

**Goal:** Die linken Provider-Views, die „Editor + Git" zu einem brauchbaren Tool machen —
Explorer, Changes, Commit/Work-Stash, Search, Structure. Diff existiert bereits (R1).

> Referenz: `build-spec.md` §3 + `ui_kits/capisco-ide/panels.jsx`/`views.jsx`/`shared.jsx`.
> Alle gegen R0-Interfaces (`Project`, `FileNode`, `ChangeSet`, `CompareBranch`), Mock-Daten.

## Akzeptanz

- DOM-Assert pro View; `verify:visual` gegen Goldens; **Virtualisierung** (Baum, Suchergebnisse).
- Tastatur/Fokus/Leer-Lade-Fehler/i18n/axe (Overview §5). Sicht-Abnahme der Explorer-Dichte.

## Phase 0 — Explorer (Multi-Projekt)

- [x] Mehrere Repos nebeneinander; Projekt-Roots als **dunkle, sticky Separator-Bars** (Name +
      Pfad + Branch/Tracking); globaler „Scratches and Consoles"-Baum; External Libraries.
- [x] Selektierte Datei: heller BG + Teal-Left-Strip + `M`/`A`-Git-Marker. Virtualisierter `tree`.

## Phase 1 — Changes & Commit/Work-Stash

- [x] **Changes**: Diff der current branch vs **Base** (Default = PR-Target wenn PR offen, sonst
      Parent; jeder Branch via searchable `combobox`). Header `base ▾ → current`, per-File `+/−`,
      Klick → Diff (R1).
- [x] **Commit (Work Stash)**: Local Changes + Shelf, gruppiert; mehrzeiliges resizable
      Commit-Feld; primärer „Commit to <branch>"-Button.

## Phase 2 — Search & Structure

- [x] **Search**: ripgrep-Stil, gruppiert nach Datei, Zeilennummern, hervorgehobene Matches,
      Replace-Feld. Virtualisiert.
- [x] **Structure**: Symbol-Outline der aktiven Datei mit Kind-Badges (class/method/property/interface/enum).

## Council-Notizen

- Diff bewusst **nicht** hier — liegt in R1, beide Einstiegspfade (Changes + ToolAction) nutzen es.
