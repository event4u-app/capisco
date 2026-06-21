---
status: complete
block: Fundament
depends_on: [road-to-app-foundation, road-to-design-primitives]
unlocks: [road-to-agents-mode, road-to-editor, road-to-git-near]
---

<!-- Fortschritt 2026-06-21: Phase 0 (Grid + Titelleiste + Statusleiste) grün; App ist jetzt
die echte Shell (Foundation-Landing ersetzt), neuer Golden `shell-dark.png`. zustand-Store
(`src/shell/store.ts`) für persistenten Layout-State. -->

<!-- Fortschritt 2026-06-21 (Phasen 1–4 abgeschlossen): Drag-&-Dock-State-Machine im Store
(`reorder`/`select`, vier Rail-Gruppen + Aktiv-Slots, dashed Bottom-Drop-Zone nur bei leerer
Gruppe), Panels/Splits (`PanelStack` mit Tastatur-bedienbarem Divider) + Bottom-Terminal
(`Terminal`/`TerminalSplitter`, Höhe persistiert), Diff-View (`DiffView` + `VirtualList`,
Split/Unified, Close→previousMode, neues `DiffDoc`-Interface + `mockDiff`) und Command-Palette
(`CommandPalette`/`command-registry.ts`, Cmd/Ctrl-K, Registry-getrieben) + Presets/Sichtbarkeit
(PO-Preset, „ausgeblendet ≠ deaktiviert"). Neue Goldens: panel-open/terminal-open/diff-split/
diff-unified. Gates frisch grün: tsc, lint (0 errors), vitest (30), build, ladle build,
playwright (14). OFFEN: **Sicht-Abnahme durch Matze** (Fidelity-Gate, Akzeptanz §) steht noch aus. -->]

# Road to Chrome-Shell (R1)

**Goal:** Das Fenster-Skelett, in das alles andere montiert wird — Titelleiste, zwei
Activity-Bars mit Drag-&-Dock, Workspace-Mode-Switching, Panels/Splits mit Persistenz,
Statusleiste, Terminal-Panel — **plus die Diff-View und die echte Command-Palette** (vom
Council vorgezogen, weil recycelte/Cross-Cutting-Flächen).

> Diff sitzt hier (nicht R3): ToolAction→Diff (R2) und Changes→Diff (R4) hängen daran
> (Reviewer 1). Command-Palette ist echtes Invariant, kein Skeleton (Reviewer 1).
> Referenz für jedes Verhalten: `build-spec.md` §2 + `ui_kits/capisco-ide/chrome.jsx`/`panels.jsx`.

## Akzeptanz

- DOM-Assert: Grid `[48][left][center 1fr][right][48]`, leere Panel-Spalten → `0px`; Titelleiste
  40px, Statusleiste 26px; Statusleisten-Felder in korrekter Reihenfolge.
- `verify:visual` grün gegen Goldens (dark + light) für die Default-Shell.
- Persistenz (Theme/Mode/Terminal-Höhe/Split-Ratios) überlebt Reload (Test).
- Tastatur: Command-Palette per Shortcut, Fokusfallen in Popups, sichtbare Focus-Rings; axe grün.
- **Sicht-Abnahme durch Matze** (Fidelity-Fläche) bevor geschlossen.

## Phase 0 — Layout-Grid & Fenster-Chrome

- [x] CSS-Grid-Layout (Rows 40/1fr/26; Rails 48px), `src/shell/Shell.tsx`, frameless-Look (macOS-Ampel-Stub). 5-Spalten-Panels in Phase 2.
- [x] **Titelleiste** (40px, `src/shell/TitleBar.tsx`): Logomark · Projekt · Branch · Run + Run-Config · Search · Theme-Toggle · More · Settings. Monochrom, Hover-Lift, i18n.
- [x] **Statusleiste** (26px, `src/shell/StatusBar.tsx`): Breadcrumb · Spacer · TS-Version · `⎇ main ↑2` · Blame · `Ln, Col` · `LF` · `UTF-8` · `✓ capisco`.

## Phase 1 — Activity-Bars + Drag-&-Dock (Hochrisiko, eigene Phase)

- [x] Zwei 48px-Icon-Rails (`src/shell/ActivityBar.tsx`), je Top-Gruppe + Bottom-Gruppe (Spacer dazwischen), Icon+Label, aktiver Zustand + Teal-Edge-Strip. An den Store verdrahtet (leftTool/mode/terminal).
- [x] **Drag-&-Dock:** Icon innerhalb/über Gruppen + in andere Rail umsortieren; Drop-Targets + persistente Bottom-Drop-Zone; Zustand persistiert. Persistente State-Machine im zustand-Store (`reorder`/`select`, vier Gruppen + Aktiv-Slots); dashed Bottom-Drop-Zone nur bei leerer Bottom-Gruppe; HTML5-DnD je Item (drop-before) + Gruppen-Fill-Zonen (append).
- [x] Rechte Rail: 4 feste Workspace-Mode-Buttons oben (Agents · Editor · Git · Tasks, `data-testid=mode-*`) über Divider; Alerts/Inspect unten. Terminal-Toggle in linker Rail (Bottom-Gruppe). Mode-Wechsel-Interaktionstest grün.

## Phase 2 — Panels, Splits, Terminal-Panel

- [x] Linkes Panel (260px) / rechte Flyout-Spalte (340px); aktives Tool-Icon erneut klicken → Pane schließen. 5-Spalten-Grid `[48][left][1fr][right][48]`, leere Panel-Spalten → `0px` (`PanelStack`).
- [x] **Vertikaler Split** wenn Top+Bottom je ein aktives Tool haben (ziehbarer horizontaler
      Divider, Ratio persistiert), kleine Uppercase-Label-Header je Pane. Splitter Pointer- + Tastatur-bedienbar (Arrow), `aria-valuenow`.
- [x] **Bottom-Terminal-Panel** mit dickem ziehbaren Splitter (Höhe persistiert), Toggle via Terminal-Icon (`Terminal`/`TerminalSplitter`), deterministisches Transkript.
- [x] Leer-/Collapsed-Zustände aller Panels (Placeholder „Not wired in this shell" für noch nicht verdrahtete Tools; leere Bottom-Gruppe = dashed Dock-Zone).

## Phase 3 — Diff-View (recyceltes Primitiv)

- [x] Side-by-side **Split** / **Unified** Toggle; added/removed/context-Zeilen; horizontales
      Scrollen für lange Zeilen; Close → zurück zum vorigen Mode. Speist sich aus `DiffDoc` (neues
      R0-Interface, abgeleitet aus `DiffStat`), Mock-Daten (`mockDiff`, `shared.jsx` `DIFF` + langer
      deterministischer Tail). **Virtualisierung** via `VirtualList` (Fenster < 80 Zeilen bei 111).
- [x] Öffnet aus zwei Quellen testbar: programmatisch (`setMode("diff")` / Palette-Command `view:diff`)
      und Close kehrt zum `previousMode` zurück (Store merkt sich den Quell-Mode).

## Phase 4 — Command-Palette & Presets/Sichtbarkeit (Cross-Cutting-Invariant)

- [x] **Command-Palette** (`command`-Primitiv, cmdk): Registry-getrieben (`command-registry.ts` —
      Built-ins aus dem Store + dynamische `register()`-API); Shortcut Cmd/Ctrl-K + Cmd/Ctrl-Shift-P.
      Eskalationsleiter (§5.6.6) — ausgeblendete Tools bleiben auffindbar und werden beim Öffnen
      ein-/angedockt.
- [x] **Presets/Sichtbarkeit** (§5.4): Tool-Sichtbarkeit per Palette (`vis:*`) ein-/ausblendbar;
      `hiddenTools` + `activePreset` persistiert. Regel hart umgesetzt: „ausgeblendet ≠ deaktiviert" —
      ein ausgeblendetes Tool ist nicht in der Rail, bleibt aber über die Palette erreichbar und wird
      beim Öffnen wieder sichtbar. PO-Preset (PR/Tickets/Changes, ohne Editor/Search/Data/etc.) als Beispiel.

## Council-Notizen

- Diff in R1 ist die *eine* Resequenzierung, die am meisten Rework spart (Reviewer 1).
- Drag-&-Dock = from-scratch State-Machine + Persistenz, im Design am häufigsten iteriert
  (design-chatlog Phase 11) → eigene Phase, hohes Risiko (Reviewer 2).
- Command-Palette + Presets gehören zusammen; ohne Presets ist die Zwei-Bar-Drag-Mechanik nur Kosmetik (Reviewer 1).
