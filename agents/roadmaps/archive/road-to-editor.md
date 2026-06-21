---
status: complete
block: Differenzierer
depends_on: [road-to-chrome-shell, road-to-design-primitives]
unlocks: [road-to-git-near]
---

# Road to Editor (R3)

**Goal:** Editor-Modus + Terminal-UI. **Klare Grenze (Council-P1):** Die CodeMirror-6-Shell
(mounten, Theme, Rainbow-Brackets, Indent-Guides, Folding, Tab-Strip) ist UI-Shell. Die
Editor-*Provider-Outputs* (Autocomplete-Popup, Inlay-Hints, Inline-Blame, Social-Presence-Lane)
sind **Mock-Provider hinter R0-Interfaces**, keine Editor-Features — sonst wächst hier ein
Fake-LSP.

> Reviewer 2: diese Roadmap ist die am stärksten unterskaliert (3×). Der Prototyp `editor.jsx`
> ist statisches Markup — CM6-Integration + Extensions sind echte from-scratch-Arbeit.
> Referenz: `build-spec.md` §7 + `ui_kits/capisco-ide/editor.jsx`.

## Akzeptanz

- DOM-Assert: Tab-Strip (pinned/dirty/active), Gutter (Zeilennr + Git-Bars + Folding), Social-Lane;
  Diff bereits aus R1 wiederverwendet. `verify:visual` gegen Goldens. Virtualisierung langer Dateien.
- Tastatur/Fokus/i18n/axe wie Overview §5. **Sicht-Abnahme** (Syntax/Rainbow/Inlay sind Pixel-Geschmack).

## Phase 0 — CM6-Shell (reine Frontend-Lib)

- [x] CodeMirror 6 read-only mounten, mit Mock-Doc; JetBrains-Dark-Theme aus Tokens (eigene
      Extension — Prototyp-`.t-line`-CSS lässt sich **nicht** auf CM6 anwenden).
- [x] Rainbow-Brackets (teal→violet→orange→gray), Indent-Guides (aktiver Block hervorgehoben),
      Code-Folding (Ranges aus Mock-Provider), Syntax-Highlighting gedämpft.
- [x] **Tab-Strip**: pinnbar, Drag-Reorder, dirty-Indikator, Doppelklick-Rename; aktiver Tab
      adoptiert Editor-Hintergrund (merge downward).

## Phase 1 — Editor-Provider-Outputs (Mock-Provider, nicht Editor-Features)

- [x] **Autocomplete-Popup** aus `CompletionItem[]` (Mock); Icons je Symboltyp, erster Eintrag teal.
- [x] **Inlay-Hints** (Parameter-Namen) aus `InlayHint[]` (Mock) als Widget-Decorations.
- [x] **Inline-Blame** aktive Zeile aus `BlameLine` (Mock).
- [x] **Social-Presence-Lane** (links der Zeilennr) aus `PresenceMarker[]` (Mock): Avatar +
      Teal-Balken über betroffenen Zeilen; Klick → Live-Presence-Popup (Identität · Diff ·
      „Cherry-pick this block"), wächst bis 80 % Editor-Breite, dann intern scrollend.

## Phase 2 — Terminal-UI

- [x] Renameable Tabs (Doppelklick), Close-×, `+`, Split/Kill-Icons; Mock-Output (`pnpm test`
      mit grünen Checks), blinkender Caret (`prefers-reduced-motion` respektiert).
      (UI-Shell: xterm.js optional, sonst gestylter statischer Output.)

## Council-Notizen

- CM6 selbst ist *kein* Backend → bleibt Shell. Aber Autocomplete/Inlay/Blame/Presence sind
  LSP-/Git-/Presence-*Outputs* → Mock-Provider, in R0-Interfaces definiert (Reviewer 1+2).
- 4 from-scratch-Builds unter einer Checkbox — beim Erreichen in echte Schritte splitten.
