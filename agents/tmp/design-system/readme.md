# Capisco — Design System

Capisco is an **agent-native desktop IDE**. It looks and feels like a serious
developer tool — JetBrains New UI / PhpStorm Dark is the reference aesthetic — but its
organizing idea is that **multiple AI agents work in parallel inside your project**,
each in its own session, each requesting capabilities through a human-in-the-loop
**capability broker**. The **Agents workspace** — session tabs and a full-width chat — is
the heart of the product and is becoming its center of gravity; the file editor is one
toggle away, not the default. Everything else is a calm, dense, familiar IDE built to
keep agent work in focus.

> Design ethos (from the brief): *restrained, professional, information-dense but calm.*
> Accent color used sparingly. No gradients, no shadow tricks, no rounded "SaaS" cards.
> Surfaces are separated by minute brightness differences, not heavy borders.

## Source of truth

- **Concept document** — *"Capisco — Agent-native, schlanke IDE"* (internal architecture &
  vision doc, German, June 2026). This is the canonical reference for what the product is
  and why. Key points the design must respect:
  - **Name thesis:** *Capisco* = "I understand" — the IDE's answer to the market pain
    "almost right, but not quite." Grounding/understanding over hallucination.
  - **Three primitives:** the **Worktree-Workspace** (every task runs in an isolated,
    reviewable git-worktree + runtime), the **Session-Tree** (a session = one model thread;
    subagents are child sessions sharing the parent workspace), and the **Provider Registry**
    (the whole IDE is assembled from providers on a thin core — first-party features use the
    same API as third-party plugins).
  - **Capability-Broker:** one subsystem for permissions *and* secrets. Mediates
    (Principal × Capability × Scope). Humans are not a privileged bypass. Invariants that are
    **not** a grant option: secrets never enter the LLM context (capability-by-reference), and
    `production` datasources are read-only for everyone — the only escape is per-command,
    once, explicit.
  - **Visual spec (§5.6):** JetBrains New UI / PhpStorm Dark is the binding reference for
    density, proportion, color, tabs, and status bar — "ordered-dense, not sparse." The
    color table in §5.6.2 matches `tokens/colors.css`; two activity bars, a context-dependent
    left panel, a pinnable tab strip, renameable terminal tabs, and a docked Session-Tree are
    all called out there and realized in the UI kit.
- **Design brief** — "Design-Brief für Claude Design — Capisco IDE (Hero-Screen)" (German):
  the detailed layout + token spec for the hero screen. The concept doc is the *why*; the
  brief is the *pixels*. Both agree on tokens.

There is **no codebase or Figma** attached; these documents are the source. If a real
codebase or Figma later exists, reconcile token values and component props and update this
readme.

### Product surfaces (for future UI kits)

The concept defines many providers that each imply a left-panel view or flyout — useful when
extending the kit. Each is "just a provider" architecturally, but real design work: Agents
(ACP sessions), Commit/Changes + Shelf, multi-project Explorer + global scratch tree, PR /
Forge board ("whose turn is it?"), **Git dashboard** (local-first personal metrics — activity,
not performance), Datasource explorer (prod read-only), Quality + AI-review diagnostics,
Task board (Jira/Linear), Runtime/container monitor, Observability, and a shared signal
(notification) surface. The kit now realizes Explorer, Work Stash (Local Changes + Shelf),
the PR / Forge board, the local-first Git dashboard, global Search, the Structure outline,
the Datasource explorer (prod read-only), the Agents workspace, Terminal, the broker prompt,
and Alerts/Inspect flyouts. Remaining provider surfaces (Task board, Runtime monitor,
Observability) are future additions.

---

## CONTENT FUNDAMENTALS

How Capisco writes. The product is a tool for professional developers, so copy is
terse, literal, and lowercase-leaning — the opposite of marketing.

- **Voice:** neutral and operational. The UI states facts; it does not sell, congratulate,
  or editorialize. No exclamation marks. No "Let's…", no "Oops!".
- **Person:** mostly impersonal/imperative. Buttons are verbs or scopes — `Allow once`,
  `This session`, `Deny`, `Run`, `Commit`. The composer placeholder addresses the agent in
  the second person but flatly: *"Message Capisco…"*. Avoid "we"/"our".
- **Casing:** product name and identifiers are **lowercase** (`capisco`, `main`,
  `broker.ts`). Section labels in chrome are **ALL-CAPS, tracked, gray** (`PROJECT`,
  `AGENTS`, `TERMINAL`). Sentence case for prose and captions. Title Case only on real
  product surfaces if ever.
- **Numbers & metadata** are first-class and always monospace + gray: runtimes
  (`2m 49s`), token counts (`6.5k ↓`), cost (`$0.04`), positions (`Ln 24, Col 8`),
  encodings (`LF`, `UTF-8`). They sit quietly to the right of their row.
- **Status language is plain:** `running`, `idle`, `waiting for approval`, `done`,
  `Approval required`. Calm, never alarmist — even a destructive command prompt is
  phrased neutrally.
- **No emoji** in UI copy. The only glyphs allowed are functional and dezent: a lock
  (🔒 / lucide `lock`) on a permission prompt, status dots, the terminal caret `❯`,
  arrows `↓ ↑`. Treat these as icons, not decoration.
- **Vibe:** quiet competence. A sentence is better if a word can be removed; a label is
  better if it can be a single word.

Examples (verbatim from the brief / system):
`Implement worktree teardown` · `Refactor broker grant model` ·
`Search: "where is port allocated?"` · `Bash(rm -rf .worktrees/tmp) — Approval required` ·
`Tokens: 6.5k · Cost: $0.04 · running 2m49s`.

---

## VISUAL FOUNDATIONS

**Theme.** Dark is canonical (`tokens/colors.css` `:root`). A full **light theme** exists
under `[data-theme="light"]` with the same token *roles* inverted — the system is
token-driven, and the UI kit demonstrates the live toggle.

**Color.** A near-neutral charcoal ramp does almost all the work. Four surface tones,
each ~10–15 in lightness apart: editor `#1E1F22`, tool-window `#2B2D30`, raised/input
`#1C1D20`, hover wash `#34373B`. Text is a three-step gray ramp
(`#DFE1E5 / #868781 / #5A5D63`). **Teal `#3FB6A8` is the only accent** and is rationed:
active states, focus, links, progress, the broker outline — never a fill across large
areas. Semantic colors (success `#4FA85A`, error `#D16E6E`, warning `#D8A65C`) are muted
and appear mostly as diff numbers and status dots.

**Surfaces & separation.** Flächen werden durch Helligkeit getrennt, nicht durch Rahmen.
Borders (`#393B40`, 1px) are used sparingly — panel splits, field outlines, the tab
strip. Do **not** outline every element. There is exactly **one** elevation in the
system: a soft popup shadow for menus/autocomplete (`--shadow-popup`). Nothing else
casts a shadow.

**Typography.** UI chrome is **Inter**, 11–14px, tight (`--lh-ui: 1.45`). Code and the
terminal are **JetBrains Mono**, 13px, line-height 1.5. Section headers are 11px ALL-CAPS,
0.06em tracking, gray. Metadata is always mono + smaller + gray. (Both fonts load from the
Google Fonts CDN — see Caveats.)

**Spacing & density.** Strict **4 / 8 / 12** raster (`--space-*`). High density that still
breathes: list rows 26px, session rows 30px, controls 24–28px. Padding is knapp and
consistent.

**Corners.** Near-square. Panels and the editor are radius 0; controls/badges/inputs are
3px; popups and the permission block are 5px. No big rounded cards anywhere.

**Borders / radii / cards.** "Cards" here are really *blocks*: a 1px border, a 3–5px
radius, a flat raised or tinted background, no shadow. The capability-broker block is the
one emphasized block — a 1px **teal-muted** outline over a faint teal tint
(`--accent-tint`), calm rather than alarming.

**Active / selection language.** The selected item in a list or activity bar gets a
**lighter background + a 2px teal strip on its edge** (left for the left bar/tree, right
for the right bar, top for the active editor tab). The active editor tab also adopts the
editor's own background so it "merges" downward into the editor.

**Hover / press.** Hover = a small brightness lift to `--bg-hover` (`#34373B`); never a
color shift, never a glow. Press nudges a control ~0.5px down. Icons go from
`--text-secondary` to `--accent` only when active. Disabled = ~45% opacity.

**Motion.** Minimal and functional (`tokens/motion.css`). Transitions are 0.12–0.18s on a
standard ease (`cubic-bezier(.4,0,.2,1)`) for hover and chevron rotation. The only loops
are a soft **pulse** on the *running* status dot and a **blink** on the terminal caret.
No bounce, no slide-in, no decorative animation. Respect `prefers-reduced-motion`.

**Imagery / texture / background.** None. No photography, no illustration, no gradients,
no patterns or grain. The "imagery" of Capisco is its own dense, syntax-highlighted code
and tree structures. Syntax colors are deliberately muted (soft violet keywords, muted
green strings, gray-italic comments, soft-orange numbers) and bracket pairs are rainbowed
in damped tones: teal → violet → orange → gray.

**Transparency / blur.** Used only for tints (`--accent-tint`, `--*-tint` semantic washes
built with `rgba`). No backdrop blur, no glassmorphism.

**Layout rules.** Fixed chrome around a single flexible **workspace**: title bar 40px,
two 48px activity bars (far left + far right), a left panel ~260px split into a
multi-project **Project Explorer** (top) and a **Work Stash** (bottom), a bottom terminal
~200px, and a 26px status bar. The center workspace fills the rest and **toggles between
Editor (tabs + code) and Agents (session tabs + full-width chat)** via the top of the
right activity bar.

- **Multiple projects load side-by-side** so the agent has them all as context: each repo
  is a top-level root in the explorer (name + path + branch/tracking), alongside
  **External Libraries** and a global **Scratches and Consoles** tree.
- The **left activity bar** carries Explorer, Commit, PR, a **Git dashboard** (stats),
  Search, Structure, Data.
- The **Work Stash** switches via tabs between **Local Changes** (uncommitted, grouped by
  project, with a commit box) and **Shelf** (shelved changelists).
- There is no permanent right panel; the right bar's lower buttons (**Alerts**, **Inspect**)
  open a **full-height flyout**. Unpinned it overlays the right of the workspace and closes
  when you click back into the workspace; **pinned, it docks as a column and the center
  shrinks** to make room. The agent chat is centered in a ~740px reading column for focus.
  Panels are collapsible; the workspace never is.

---

## ICONOGRAPHY

- **System:** [Lucide](https://lucide.dev) — linear, ~1.5px stroke, monochrome. This is
  the closest CDN-available match to the JetBrains New UI line-icon style described in the
  brief ("Icons schlicht/linear (Lucide-Stil)"). Loaded from CDN
  (`unpkg.com/lucide`), rendered via `<i data-lucide="name">` + `lucide.createIcons()`.
  **Substitution flagged:** if Capisco ships its own icon set, drop the SVGs into
  `assets/icons/` and document them here.
- **Color:** icons inherit `--text-secondary` and shift to `--accent` only when their
  control is active. Never multicolor.
- **File-type icons:** Lucide `file-code` / `file-text` / `folder` / `folder-open`,
  tinted with syntax tokens (`--syn-type` for `.ts`). A future real build would use
  JetBrains-style colored file badges.
- **Functional glyphs (not icons):** the lock on a permission prompt, status dots, the
  terminal caret `❯`, and token-flow arrows `↓ ↑`. These are intentional and dezent.
- **Emoji:** **not used** in UI. (The brief mentions 🔒 only as shorthand for the lock
  icon.)
- **Brand mark:** `assets/capisco-mark.svg` (two-tone) and `capisco-mark-teal.svg` (mono).
  A session-tree glyph — a parent node branching to children — echoing the product's core
  concept. **Placeholder**, pending a real brand asset.

---

## INDEX — what's in this system

**Root**
- `styles.css` — the one file consumers link. `@import`s every token + font file below.
- `readme.md` — this guide.
- `SKILL.md` — Agent-Skills-compatible entry point.

**`tokens/`** — CSS custom properties (`:root`, plus `[data-theme="light"]` overrides)
- `fonts.css` · `colors.css` · `syntax.css` · `typography.css` · `spacing.css` · `motion.css`

**`components/`** — reusable React primitives (`window.CapiscoDesignSystem_026f1e`)
- `core/` — **Button**, **IconButton**, **Input**
- `indicators/` — **StatusDot**, **ModelBadge**, **GitMarker**
- `ide/` — **EditorTab**, **TreeRow**, **ToolAction**, **PermissionPrompt**

**`guidelines/`** — foundation specimen cards (Design System tab): color surfaces, accent,
text ramp, syntax, type (sans/mono), spacing scale, chrome zones, brand logo.

**`ui_kits/`**
- `capisco-ide/` — the hero screen: the full Capisco main window, interactive, with a
  dark/light theme toggle. Agent-first — the center workspace toggles Editor/Agents from
  the right rail; the left panel pairs the Explorer with a Work Stash; Alerts/Inspect open
  pinnable flyouts. `index.html` composes the primitives above (`shared/chrome/panels/
  editor/agent` JSX).

**`assets/`** — `capisco-mark.svg`, `capisco-mark-teal.svg`.

**`_shadcn/`** — production **shadcn/ui source** (Radix + Tailwind + `cva`) for the real
Vite/Next frontend. shadcn's API and conventions, themed to Capisco's JetBrains-dark palette
via `app/globals.css` (shadcn token *names*, Capisco *values*; `.dark` is canonical). Has
`components.json`, `tailwind.config.ts`, `lib/utils.ts`, `components/ui/*` (button, input,
badge, card, tabs, tooltip, dropdown-menu) and `components/capisco/*` (status-dot,
model-badge, permission-prompt). See `_shadcn/README.md` for setup. The in-browser
`ui_kits/` kit demonstrates the look; `_shadcn/` is what the product ships. (The leading
underscore keeps this production source out of the in-browser component bundle.)

