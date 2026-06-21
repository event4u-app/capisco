# Capisco IDE — Build Spec for Claude Code

A complete description of the Capisco IDE prototype: what it is, every view, how each
behaves, and the design decisions behind them. Hand this to Claude Code to rebuild the UI
as production React. The reference prototype lives at `ui_kits/capisco-ide/` (index.html +
`shared.jsx`, `chrome.jsx`, `panels.jsx`, `editor.jsx`, `agent.jsx`, `views.jsx`,
`charts.jsx`). Design tokens are in `/tokens/*.css`, surfaced through `styles.css`.

> **Hinweis (siehe `build-plan.md`):** Dieses Dokument beschreibt die **UI-Shell** —
> Aussehen und Verhalten. Daten, State, IPC, ACP und die echte Session-/Worktree-/Broker-
> Logik sind hier *nicht* spezifiziert. Vor der Übergabe an Claude Code `build-plan.md`
> lesen: Phasenschnitt, Korrekturen (Overdue-Schwelle, Chat-Spalte), Komponenten-Ebenen
> und die fehlenden Produktionsschichten.

---

## 1. What Capisco is

Capisco is an **agent-native desktop IDE** (Tauri/desktop, not a web app). The name is
Italian for *"I understand"* — the product's thesis is grounding/understanding over
hallucination. Aesthetic reference: **JetBrains New UI / PhpStorm Dark** — dense, ordered,
calm, professional. Not a playful SaaS product.

Three core primitives drive the model:
- **Worktree-Workspace** — every task runs in an isolated, reviewable git-worktree + runtime.
- **Session-Tree** — a session = one model thread; subagents are child sessions sharing the
  parent's worktree.
- **Provider Registry** — the whole IDE is assembled from providers on a thin core; first-party
  features use the same API as third-party plugins. Every left/right tool is "just a provider."

A **Capability-Broker** mediates all permissions and secrets as (Principal × Capability ×
Scope). Humans are not a privileged bypass. Hard invariants (never a grant option): secrets
never enter the LLM context; `production` datasources are read-only for everyone.

---

## 2. Layout & window chrome

A frameless desktop window (macOS traffic lights). Top-to-bottom:

- **Title bar (40px)** — traffic lights · Capisco logomark · project dropdown `capisco ▾` ·
  branch `⎇ main ▾` · spacer · Run ▷ · run-config `Dev ▾` · search · theme toggle · more · settings.
- **Main row** — CSS grid: `[left activity bar 48px] [left panel] [center 1fr] [right panel] [right activity bar 48px]`. Panel columns collapse to `0px` when empty.
- **Status bar (26px)** — breadcrumb (adapts to the active workspace mode) · spacer · TypeScript
  version · `⎇ main ↑2` · blame · `Ln, Col` · `LF` · `UTF-8` · `✓ capisco`.

### Activity bars — the tool-window dock
Both side bars are **icon rails** that host **tools** (each opens a panel). The model:
- Each bar has a **top group** and a **bottom group** separated by a flexible spacer.
- A tool's region (top vs bottom) follows its **group membership**, not any divider's position.
- **Drag any tool icon** to reorder within a group, move it across the spacer to the other
  group, or move it to the other bar entirely. Drop targets: each icon (inserts before it),
  the flexible spacer (→ end of top group), and a **persistent dashed icon-sized drop zone at
  the very bottom** (→ bottom group). That bottom placeholder shows **only while the bottom
  group is empty** and collapses once it holds a tool.
- The **left bar** also contains the **Terminal** toggle as a draggable item (default: bottom
  group). Clicking it shows/hides the bottom terminal panel; dragging it sets where the
  terminal sits relative to other bottom tools.
- The **right bar** has four **fixed workspace-mode buttons at the top** (Agents · Editor ·
  Git · Tasks) above a divider, then its draggable tool groups below.

### Panels & vertical split
- A bar's panel opens the **active tool** of each group. If a group in **both** the top and
  bottom has an active tool, the side panel **splits vertically** (top tool over bottom tool)
  with a **draggable horizontal divider** (persisted ratio). Each pane has a small uppercase
  label header.
- Left panel default width 260px, right panel 340px. Clicking an active tool icon again
  toggles its pane closed.

### Center workspace
The center shows **one of five modes**, switched by the right bar's workspace buttons plus an
internal diff mode:
- `agents` (default) · `editor` · `git` · `tasks` · `diff`.
Below the workspace is a **resizable bottom panel** (Terminal) with a thick draggable splitter
(height persisted); toggled by the Terminal icon.

---

## 3. Left-bar tools (provider views)

| Tool | Purpose |
|---|---|
| **Explorer** | Multi-project file tree — several repos loaded side-by-side (so the agent has them all as context) + a global "Scratches and Consoles" tree. Project roots render as **dark raised sticky separator bars** with the branch indicator; selected file gets a teal left strip + `M`/`A` git markers. |
| **Changes** | Diff of the current branch vs a **base branch**. Base defaults to the **PR target** if the branch has an open PR, else the **parent** it branched from; any other branch is pickable via a **searchable combobox**. Header reads `base ▾ → current`. Lists changed files with per-file `+adds/−dels`; clicking a file opens the Diff view. |
| **Commit** (Work Stash) | Local Changes + git Shelf, grouped, with a multi-line resizable commit message box and a primary "Commit to <branch>" button. |
| **PR** | Pull-request list for loaded projects. |
| **Tasks** | Quick ticket list (sidebar form). The full board is the Tasks **workspace** (§5). |
| **Search** | ripgrep-style results grouped by file, line numbers, highlighted matches, a Replace field. |
| **Structure** | Symbol outline of the active file with kind badges (class/method/property/interface/enum). |
| **Data** | Datasource explorer grouped by connection; `prod` shows a **READ-ONLY** badge + lock glyphs on its tables (broker invariant). |
| **Services** | Docker/container management (ctop-style), **grouped by loaded project** with sticky dark headers and an `N/M up` count. Each row: status dot, name, image, CPU bar, mem, ports, and an `exec -it` console action. |

Right-bar tools (default): **Alerts** and **Inspect** — severity-dotted lists (waiting/success/
warning/idle) that open as right-panel tool windows.

---

## 4. Center mode: Agents (default)

The heart of the product.
- **Session tabs** across the top — each shows a status dot, model badge, title, runtime ·
  token meta. A **gear** at the right opens **Agent backend settings**; a **`+`** opens a
  "New session with…" menu (pick the model/agent first, which creates the session).
- **Subagent row** — the active session's child agents as small branch chips.
- **Chat transcript** centered in a ~740px reading column: alternating You/agent messages
  (hover reveals retry/copy/branch), **ToolAction** blocks (collapsible; verb + mono target +
  `+adds/−dels`; an **open-in-editor** icon on the right jumps to the file), and the signature
  **Capability-Broker permission prompt** — a calm teal-outlined block with the requested
  capability in mono and scope buttons `[Allow once] [This session] [Deny]` (primary / default /
  ghost). New sessions show an empty state.
- **Composer** — message input with a **control bar underneath** (Claude-Desktop style):
  **model picker** · **reasoning effort** popover (Faster↔Smarter 6-step slider) · **budget
  ring** opening a **Plan usage** popover (5-hour / weekly / model-specific / credits, each a
  labeled progress bar). Live status (backend · tokens · cost · runtime) sits on the same bar.
- **Agent backend settings popover** — choose **API client** (provider + token field, "stored
  in your OS keychain") or **Installed CLI** (detected binary + path). Footer reflects the choice.

---

## 5. Center mode: Git dashboard

Header "Git Dashboard" + a **filter on every tab**: `All / Day / Week / Month` plus a
**Custom** dropdown (preset ranges + from–to date inputs). Tabs:
- **My PRs** — open PRs across loaded projects, GitHub-detailed: open/draft state, title +
  number, repo · branch, age, labels, CI checks (passing/failing/running), reviewer avatars
  with approve/changes/pending rings, comments and `+/−`.
- **Review Requested** — PRs where your review is expected (directly requested *or* ones you
  reviewed before — the latter highlighted with a teal edge + "you reviewed before").
- **Overdue** — non-draft PRs open longer than **3 days** (ready-for-review), amber "Nd ready" badge.
- **Team** — git.live-style awareness: who's working where (By PR / By branch toggle), what
  they're touching, an **overlap warning** when their files clash with your uncommitted work,
  and **Cherry-pick**.
- **Overview** — DORA-style metric cards (Lead Time · Deployment Frequency · Change Failure
  Rate, with tier badges + trend deltas), a Cycle-Time line chart, a PR-Categories donut.
- **Activity** — weekly line charts (commits, PRs merged, lines changed, reviews), language
  breakdown, commits-per-day bars.
- **Working Times** — a **7×24 activity heatmap**. A **Working hours** selector (default
  **09:00–17:00**, end runs to 24:00) recolors live: activity inside core hours is **green**,
  outside/weekend is **red**, darkness = volume. Carries the honest note: "Activity, not
  performance · stays on this machine · never compared across people."

All charts are lightweight inline SVG (line / donut / heatmap / burndown) themed from tokens.

---

## 6. Center mode: Tasks (Jira/Linear)

A **tabbed workspace**: the **Overview** tab is home; clicking any ticket opens it in **its
own closable tab** beside Overview.

Overview sub-tabs:
- **Board** — Linear-style: status columns (Backlog → Done) × **epic swimlanes**, full width
  (no horizontal scroll), rich cards (ID, assignee avatar, type label, "mine" flag, PR/subtask
  footer), full-height column dividers.
- **My Tickets** & **Active** — grouped **columns** by status (consistent column style; Active
  = In Progress / Review / Testing).
- **Insights** — analytics dashboard: top metric cards (My WIP, Throughput, Reviews requested,
  Avg cycle time), **sprint burndown + private burndown** (ideal dashed vs actual solid stopping
  at today), My-WIP-over-sprint line, **Team WIP** bars (vs per-person limits, amber when over),
  reviews/day, throughput bars, work-type donut.

Ticket detail tab: editable **Description**, an **Activity** comment thread with a composer
(⌘↵ to send), and a sidebar (status, assignee, type, points, epic, linked PR) with **Create
branch** (primary) and **Start in a worktree** (default) actions.

---

## 7. Center mode: Editor & Diff

**Editor** — JetBrains-style code view: gutter line numbers + git change bars, syntax
highlighting (muted, not neon), **rainbow brackets** (teal→violet→orange→gray), indent guides,
an open autocomplete popup, **parameter-name inlay hints** before call arguments, and **inline
blame** on the active line (author · date · commit message). A **reserved social lane** left of
the line numbers holds, per line, a colleague **presence avatar** plus a teal indicator bar
spanning the lines they've touched (git.live live-changes). Clicking the avatar opens a
**live-presence popup**: their identity (branch · PR · time), an inline diff of their change,
and **Cherry-pick this block**. The popup sizes to content up to **80% of the editor width**,
then scrolls internally.

**Diff** — opens from a changed file (Changes/Commit) or a ToolAction. Side-by-side **Split**
or **Unified** toggle; added/removed/context rows; horizontal scroll for long lines; close
returns to Editor.

**Terminal** (bottom panel) — renameable tabs each with a close ×, a `+` to add, tool icons
(split/kill), a plausible `pnpm test` run with green checks, and a blinking caret prompt.

---

## 8. Design system & decisions

**Theme** — Dark is canonical; a full **Light theme** exists via `[data-theme="light"]` with the
same token *roles* inverted (toggle in the title bar; persisted in localStorage).

**Color** — a near-neutral charcoal surface ramp does the work: editor `#1E1F22`, tool-window
`#2B2D30`, raised/input `#1C1D20`, hover `#34373B`. Text ramp `#DFE1E5 / #868781 / #5A5D63`.
**Teal `#3FB6A8` is the only accent** and is rationed to active/important states — never large
fills. Semantic (muted): success `#4FA85A`, error `#D16E6E`, warning `#D8A65C`; git markers
modified=amber, added=green, deleted=red. **Decision:** separate surfaces by **brightness, not
borders**; borders (`#393B40`, 1px) are sparing.

**Type** — UI chrome **Inter** 11–14px (dense, 1.45); code/terminal **JetBrains Mono** 13px / 1.5.
Section labels are 11px ALL-CAPS, 0.06em tracking, gray. Metadata is always mono + smaller + gray.
(Fonts load from Google Fonts CDN in the prototype — self-host in production.)

**Spacing & shape** — strict 4/8/12 raster; list rows 26px, session rows 30px, controls 24–28px.
Near-square corners: panels 0, controls/badges 3px, popups/prompts 5px. **One** elevation in the
system (a soft popup shadow for menus/autocomplete/flyouts); nothing else casts a shadow. No
gradients, no rounded "SaaS" cards.

**Active/selection** — selected item gets a lighter background + a **2px teal strip** on its edge
(left for left rail/tree, right for right rail, top for active editor/session tabs). The active
editor tab also adopts the editor background so it merges downward.

**Hover/press/motion** — hover = small brightness lift to `--bg-hover` (never a color shift or
glow); press nudges ~0.5px; disabled ~45% opacity. Motion is minimal & functional: 0.12–0.18s
ease for hover/chevron/expand; the **only loops** are the running-status pulse and terminal
caret blink. Respect `prefers-reduced-motion`.

**Iconography** — **Lucide** (linear, ~1.6px stroke, monochrome); color shifts to teal only when
active. No emoji in UI; the only functional glyphs are the broker lock, status dots, terminal
caret `❯`, and token-flow arrows. **Brand mark** is a session-tree glyph (parent node branching
to children) — `assets/capisco-mark.svg` (placeholder pending a real asset).

**Imagery/texture** — none. No photos, illustration, gradients, patterns, or blur/glass. The
"imagery" is the dense, syntax-highlighted code and tree structures themselves.

**Content voice** — terse, neutral, operational. Product name lowercase (`capisco`). Buttons are
verbs/scopes. Numbers/metadata are first-class and mono. Calm even for destructive prompts
(no exclamation marks, no emoji).

**Persistence** — theme, workspace mode, terminal height, and split ratios persist in
localStorage.

---

## 9. Component inventory (design-system primitives)

Reusable React primitives live in `/components` and compile to `window.<Namespace>`:
- **core/** — `Button` (default / primary / ghost; sm/md), `IconButton` (active + edge strip),
  `Input` (sunken; mono mode; leading/trailing slots).
- **indicators/** — `StatusDot` (running pulse / idle / waiting half-fill / error / done),
  `ModelBadge` (neutral/accent), `GitMarker` (M/A/D/U).
- **ide/** — `EditorTab` (active/pinned/dirty), `TreeRow` (depth/chevron/active/git trailing),
  `ToolAction` (collapsible diffstat + optional open-in-editor), `PermissionPrompt` (the
  capability broker block).

Build production components in this idiom (Radix-style props, variants, CSS custom properties for
theming). Don't reimplement primitives inside screens — compose them.
