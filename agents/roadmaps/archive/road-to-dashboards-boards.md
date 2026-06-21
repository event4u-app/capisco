---
status: complete
block: Breite
depends_on: [road-to-git-near]
unlocks: [road-to-tooling-breadth]
---

# Road to Dashboards & Boards (R5)

**Goal:** Git-Dashboard (7 Tabs) + Tasks-Workspace (Board/Insights/Burndowns) + die Inline-SVG-
Charts. Tab für Tab, nicht als Monolith.

> Referenz: `build-spec.md` §5+§6 + `ui_kits/capisco-ide/views.jsx`/`charts.jsx`/`shared.jsx`.
> **Korrektur (build-plan §3): Overdue = 7 Tage, konfigurierbar** (nicht 3, nicht fest).

## Akzeptanz

- DOM- + **SVG-Struktur-Assertions** (Pfade/Punkte der Charts), `verify:visual` gegen Goldens.
- **Ehrlichkeits-UI (§6):** „Activity, not performance · stays on this machine · never compared
  across people" sichtbar; LoC nie als Rangliste. Overdue-Schwelle konfigurierbar (Default 7d).
- Tastatur/Leer-Lade-Fehler/i18n/axe. **Sicht-Abnahme** (Charts sind visuell).

## Phase 0 — Git-Dashboard (Tabs schrittweise)

- [x] Header „Git Dashboard" + **Filter auf jedem Tab** (All/Day/Week/Month + Custom-Range).
- [x] **My PRs** (GitHub-detailliert: State, Checks, Reviewer-Ringe, Labels, +/−).
- [x] **Review Requested** (direkt angefragt *oder* „you reviewed before", letztere teal-hervorgehoben).
- [x] **Overdue** (non-draft, älter als **7 Tage konfigurierbar**, amber „Nd ready"-Badge).
- [x] **Team** (git.live-Awareness: By PR/By branch, Overlap-Warnung, Cherry-pick).
- [x] **Overview** (DORA-Cards + Cycle-Time-Line + PR-Categories-Donut).
- [x] **Activity** (Weekly-Line-Charts, Sprachen-Breakdown, Commits/Tag).
- [x] **Working Times** (7×24-Heatmap, Arbeitszeit-Selektor Default 09–17, Live-Recolor grün/rot).

## Phase 1 — Tasks-Workspace

- [x] **Board** (Linear-Stil: Status-Spalten × Epic-Swimlanes, volle Breite, reiche Karten).
- [x] **My Tickets** + **Active** (Spalten nach Status).
- [x] **Insights** (Metric-Cards, **Sprint- + Private-Burndown** ideal-dashed vs actual-solid,
      My-WIP-Line, Team-WIP-Bars vs Limits, Reviews/Tag, Throughput, Work-Type-Donut).
- [x] **Ticket-Detail-Tab** (eigener schließbarer Tab: editierbare Description, Activity-Thread
      mit Composer ⌘↵, Sidebar mit „Create branch" + „Start in a worktree").

## Phase 2 — Chart-Primitive

- [x] Inline-SVG Line/Donut/Heatmap/Burndown aus `charts.jsx` ins Production-Idiom: responsive,
      tokenisiert, themed, Empty-States. Wiederverwendbar.

## Council-Notizen

- Charts/Heatmap/Dual-Burndown = bespoke from-scratch, produktionsreif machen ist eigene Arbeit (Reviewer 2).
- Overdue-Korrektur nicht vergessen; Goldens müssen die *korrigierte* Variante zeigen (Reviewer 3).
