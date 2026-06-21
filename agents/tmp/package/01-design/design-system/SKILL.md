---
name: capisco-design
description: Use this skill to generate well-branded interfaces and assets for Capisco, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Capisco in one line
An agent-native desktop IDE (JetBrains New UI / PhpStorm-Dark aesthetic) whose heart is a right-hand **Agent / Session-Tree** panel and a human-in-the-loop **capability broker**. Restrained, dense, calm. Teal accent used sparingly.

## What's here
- `readme.md` — the full design guide: context, content voice, visual foundations, iconography, file index. **Read this first.**
- `styles.css` — the single stylesheet to link; `@import`s all tokens + fonts.
- `tokens/` — colors (dark canonical + `[data-theme="light"]`), syntax, typography, spacing, motion.
- `components/` — React primitives: `core/` (Button, IconButton, Input), `indicators/` (StatusDot, ModelBadge, GitMarker), `ide/` (EditorTab, TreeRow, ToolAction, PermissionPrompt). Each has a `.prompt.md` with usage.
- `guidelines/` — foundation specimen cards (colors, type, spacing, brand).
- `ui_kits/capisco-ide/` — the hero screen: the full Capisco main window, interactive, dark/light. Best reference for composing the system.
- `_shadcn/` — production **shadcn/ui source** (Radix + Tailwind + cva) for a real Vite/Next app, themed to Capisco's JetBrains-dark palette. Use for production code; the in-browser kit is for mocks. See `_shadcn/README.md`. (Underscore-prefixed so the in-browser bundler skips it.)
- `assets/` — `capisco-mark.svg`, `capisco-mark-teal.svg` (placeholder brand mark).

## Working rules (the short version)
- **Dark is canonical.** Surfaces separate by brightness (`#1E1F22` editor, `#2B2D30` tool, `#1C1D20` raised), not heavy borders. One accent: teal `#3FB6A8`, rationed to active/important states.
- **Type:** Inter for chrome (11–14px), JetBrains Mono for code/terminal (13px / 1.5). Section labels are 11px ALL-CAPS tracked gray. Metadata is always mono + gray.
- **Density:** strict 4/8/12 spacing; rows 26–30px; corners near-square (0 / 3 / 5px). No gradients, no big shadows (one popup shadow only), no rounded SaaS cards.
- **Icons:** Lucide, linear, monochrome, ~1.6px stroke. Color shifts to teal only when active. No emoji in UI.
- **Voice:** terse, lowercase product name, neutral. Verbs/scopes on buttons. Calm even for destructive prompts.
- **Motion:** 0.12–0.18s ease for hover/expand; the only loops are the running-status pulse and terminal caret. Respect `prefers-reduced-motion`.

When in doubt, open `ui_kits/capisco-ide/index.html` and match it.
