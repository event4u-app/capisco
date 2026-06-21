---
status: complete
block: Fundament
depends_on: [road-to-app-foundation]
unlocks: [road-to-chrome-shell, road-to-agents-mode]
---

# Road to Design-Primitives (R0-Primitive)

**Goal:** Die ~12 shadcn/Radix-Primitive bauen, die die Screens brauchen und die in `_shadcn/`
**fehlten** — jedes im shadcn-Idiom, auf die Capisco-Tokens gethemt, mit Story (+ Test/axe).

> **Abgeschlossen 2026-06-21.** `components.json` angelegt; Root-`tsconfig.json` `paths`
> ergänzt → shadcn-CLI löst `@/` jetzt korrekt auf. `react-resizable-panels` auf v3 gepinnt
> (v4-API-Umbenennung). Kontrast-Anomalie des Primary-Buttons auf dem temporären Landing nach
> R2 deferred (DECISIONS.md). 13 Primitive-Stories bauen, 10 Unit-Tests grün.

## Akzeptanz

- [x] Jedes Primitiv: TS-typisiert, Story; Tree zusätzlich Unit/Interaction-Test; axe (Ladle-Addon).
- [x] `verify:visual`/Build grün; Stories bauen in Ladle.
- [x] Kein Primitiv hardcodet Hex — alles über Tokens.

## Phase 0 — Overlay- & Layout-Primitive

- [x] **`popover`** (Radix) — Effort-/Budget-/Modell-Popover (R2). + Story.
- [x] **`dialog`** + **`sheet`** (Radix) — Modals/Settings/Flyout. + Stories.
- [x] **`command`** (cmdk) + **`combobox`** (popover+command) — Palette (R1) + Branch-Picker (R4). + Story.
- [x] **`resizable`** (react-resizable-panels v3) — Panel-Splits/Terminal (R1). + Story.
- [x] **`scroll-area`** + **`separator`**. + Story.

## Phase 1 — Control- & Display-Primitive

- [x] **`slider`** — Reasoning-Effort (R2). + Story.
- [x] **`progress`** — Plan-Usage / CPU-Mem-Bars (R2/R6). + Story.
- [x] **`avatar`** — Reviewer/Presence (R3/R5). + Story.
- [x] **`toggle-group`** (+ `toggle`) — Split/Unified etc. + Story.
- [x] **`tree`** — eigenes a11y-Primitiv (role=tree/treeitem, Pfeiltasten-Nav, virtualisierungs-freundlich via Flat-Rows). + Story + Unit-Tests.

## Phase 2 — Capisco-spezifische Komposita

- [x] **`ToolAction`** (collapsible Diffstat + open-in-editor) im shadcn-Idiom. + Story.
- [x] **`EditorTab`** (active/pinned/dirty + Top-Edge-Strip). + Story. (TreeRow ist Teil des `tree`-Primitivs.)
- [x] **`BudgetRing`** (SVG-Usage-Ring). + Story.
- [x] **`StatusDot`/`ModelBadge`/`GitMarker`** verifiziert/ergänzt (GitMarker neu). + Stories.
      Kontrast-Anomalie diagnostiziert (Mess-/Komposit-Artefakt am temporären Landing) → Fix nach R2 deferred.

## Council-Notizen

- Overlay-Primitive zuerst — Differenzierer-Controls hängen daran. ✓
- `tree` als eigenes virtualisierungs-freundliches Primitiv (Reviewer 2). ✓
