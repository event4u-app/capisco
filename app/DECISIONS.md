# Capisco App — Decision Gates

Foundation-Entscheidungen mit gesetzten Defaults (Quelle:
`agents/roadmaps/00-capisco-overview.md` §3). **Override:** hier ändern + Begründung.

| Gate | Entscheidung | Status | Begründung |
|---|---|---|---|
| Shell-Träger | **Vite-only Browser-App** (Tauri-Wrapper später) | angewendet | Track UI-Shell; maximal autonom verifizierbar. „Desktop"-Verhalten kommt hinter ein `DesktopShell`-Interface (noch nicht nötig). |
| Komponenten-Quelle | **`_shadcn/` kanonisch** → `src/components/{ui,capisco}` | angewendet | build-plan §1. In-Browser-`components/` ist nur Mock-Spiegel. |
| Tailwind | **v3** (`^3.4`), HSL-CSS-Vars | angewendet | Gelieferte `tailwind.config.ts` ist v3-Stil. |
| Theme | **Dark kanonisch** (`.dark`), Light-Toggle, `localStorage` | angewendet | Konzept §5.6. `src/lib/theme.tsx`. |
| Fonts | **self-hosted** via `@fontsource/{inter,jetbrains-mono}` | angewendet | build-plan §5; kein CDN (Determinismus für Harness). |
| Icons | **Lucide** als npm-Dep, gebündelt (`src/components/icon.tsx`) | angewendet | Design-Readme; kein CDN-Inject. |
| Brand-Mark | **Platzhalter** `src/assets/capisco-mark*.svg` | angewendet | build-plan §5; echtes Asset später. |
| i18n | **react-i18next**, `en` default, ab Tag 1 | angewendet | Konzept §5.9. `src/i18n/`. |
| Overdue-Schwelle | **7 Tage, konfigurierbar** | angewendet (R5) | build-plan §3-Korrektur (nicht 3). `mockGitProvider.overdueThresholdDays = 7`; Overdue-Tab + PR-`Nd ready`-Badge gegen diesen Wert (Prototyp hartkodierte `> 3` — korrigiert). UI-Selektor in der Filterleiste des Overdue-Tabs (Default 7). |
| Chart-Farb-Tokens (R5) | **Eigener `--chart-*`-Block in `globals.css`** (HSL-Tripel, light+dark), konsumiert via `hsl(var(--chart-line))` etc. | angewendet | Der Prototyp nutzt rohe `var(--accent)`/`var(--syn-*)`-Tokens aus `tokens/colors.css`+`tokens/syntax.css`, die **nicht** in die App importiert werden (nur `globals.css` lädt main.tsx). Charts dürfen daher diese rohen Tokens nicht referenzieren. Stattdessen ein gethemter Chart-Palette-Block (`--chart-1..6`, `--chart-line`, `--chart-ideal`, `--chart-grid`, `--chart-good`/`--chart-bad` für die Heatmap), abgeleitet aus den existierenden Rollen. Kein hartcodiertes Hex in Komponenten. |
| Git/Tasks-Datenform (R5) | **`mockGitProvider` + `mockTasksProvider`** hinter den R0-Interfaces (`PullRequest`/`Metric`/`AwarenessEntry`/`WorkHeatmap`/`Ticket`/`Epic`/`Sprint`/`BurndownSeries`), ergänzt um `WeeklySeries`/`DonutSegment`/`LangStat`/`WipRow`/`TicketColumn` für die Chart-Eingaben | angewendet | R0 nannte die Kern-Shapes; die Chart-Serien (Weekly-Line-Daten, Donut-Segmente, Sprach-Breakdown, Team-WIP, Throughput) brauchen eigene deterministische Eingabe-Shapes. Alle Werte aus `shared.jsx`, deterministisch (kein Date.now/Math.random). |
| Git/Tasks-Center-Workspace (R5) | **Eigene Center-Workspaces** (`shell/git/GitWorkspace`, `shell/tasks/TasksWorkspace`), gemountet in `Shell` für `mode==="git"`/`"tasks"` (vorher Placeholder) | angewendet | Prototyp `GitWorkspace`/`TaskDashboard` sind Center-Flächen (volle Breite), keine Left-Panels. Der `mode`-Switch der ActivityBar existiert bereits; nur das Rendering fehlte. |
| Ticket-Detail-Tabs (R5) | **Lokaler `useState` im `TasksWorkspace`** (offene Ticket-IDs + aktiver Tab), schließbar | angewendet | Prototyp `TaskDashboard` hält offene Tickets lokal; kein globaler Store nötig (Tabs sind workspace-lokal, überleben keinen Reload — bewusst, wie der Prototyp). |
| Tooling-Datenform (R6) | **`mockContainerGroups` + `mockDatasources` + `mockSignalProvider`** hinter den R0-Interfaces (`ContainerGroup`/`ServiceStat`, `Datasource`/`DbTable`, `SignalItem`), ergänzt um `SignalSource`/`SignalRule`/`SignalProvider` für die geteilte Signal-Fläche | angewendet (R6) | R0 nannte die Kern-Shapes; §5.2 verlangt *eine* Schiene, die PR/Container/Observability/Agent/Lint in **eine** `SignalItem`-Form faltet — dafür die `source`-Achse + eine bewusst dumme Regel-Liste (`SignalRule[]`, 5 Regeln) + ein `signalsFor(channel)`-Selektor. Alle Werte deterministisch aus `shared.jsx` (kein Date.now/Math.random). |
| Datasource-Credential (R6) | **`credentialRef`-Feld** (Referenzname, z.B. `prod-readonly`), nie ein Wert | angewendet (R6) | Invariante §2.1 „Secrets nie als Wert" — der Prototyp zeigte gar kein Credential; die App surface es als Referenz (`credential: prod-readonly`). Test verifiziert, dass der Wert keine Secret-Form (`:`/`=`/`password`/`token`) hat. |
| Flyout-Pin (R6) | **`pinnedFlyouts: string[]` im Layout-Store** (+ `togglePin`, `FLYOUT_TOOL_IDS`, `useActiveOverlayFlyout`); unpinned = Overlay über dem Center (kein Grid-Shrink, `onClickCapture` im Workspace schließt), pinned = normale rechte PanelStack-Spalte (Center schrumpft auf 340px) | angewendet (R6) | §2: „pinned dockt als Spalte, Center schrumpft; unpinned overlay schließt bei Klick in Workspace". Der Prototyp rendert Alerts/Inspect nur als normale Rechts-Panels — Pin/Overlay ist die hier verankerte Konzept-Fläche. Pin-Toggle in der Flyout-Kopfzeile + Command-Palette (`pin:*`), persistiert (Store-Version 3). |
| Services-Rail-Default (R6) | **`services` zur `DEFAULT_GROUPS.leftTop`** ergänzt | angewendet (R6) | Der Tool war im Store nie im Default-Rail gedockt (Prototyp `leftTop` enthält ihn); ohne Eintrag gab es keinen `rail-item-services`. |
| Chat-Lesespalte | **zentriert ~740px** | offen (R2) | build-plan §3-Korrektur. |
| Editor-Lib | **CodeMirror 6** (read-only, Mock-Doc) | angewendet (R3) | Konzept §5.6.6 „reife Basis erben". CM6 deps: `@codemirror/{state,view,language,lang-javascript,commands}` + `@lezer/highlight`. |
| Editor-Theme (R3) | **Eigene CM6-Extension** (`cm-theme.ts` + `cm-extensions.ts`), Werte aus den CSS-Token-Vars (`--syn-*`, `--bracket-*`, `--indent-guide*`) | angewendet | Prototyp-`.t-line`-CSS lässt sich nicht auf CM6 anwenden; CM6-Theme referenziert die Live-CSS-Vars → Light-Theme invertiert gratis. Rainbow-Brackets + Indent-Guides als ViewPlugins, Git-Change-Bars als eigener Gutter. |
| Editor-Datenform (R3) | **`EditorDoc`** (`{file, ext, text, pinned?, dirty?}`) + Provider-Outputs `ChangeBar`/`FoldRange` ergänzt zu R0-`editor.ts` | angewendet | R0-Interfaces nannten nur die vier Provider-Output-Shapes; CM6 braucht den rohen Doc-Text (das Einzige, was CM6 indiziert) plus Git-Change-Bars und Fold-Ranges als **Provider**-Output (Council-P1: aus dem Mock, nicht aus CM6-Syntax). `PresenceMarker` um `init` + `diff[]` erweitert (Avatar-Initialen + Inline-Diff fürs Live-Popup). |
| Code-Folding-Quelle (R3) | **`foldService` aus den Mock-`FoldRange[]`**, nicht auto-collapsed beim Mount | angewendet | Roadmap: „Code-Folding (Ranges aus Mock-Provider)". Ein `foldService` macht die Provider-Ranges faltbar (Chevrons im Fold-Gutter); Auto-Collapse beim Mount würde den Showcase-Code (Prototyp zeigt die volle Datei) verstecken. `javascript()` trägt zusätzliche Syntax-Folds bei — Folds sind also ≥ die 2 Provider-Ranges. |
| Provider-Output-Rendering (R3) | **React-Overlays über der CM6-Sicht** (Autocomplete/Inlay/Blame/Social-Lane), positioniert aus den Mock-Zeilendaten | angewendet | Council-P1: das sind LSP-/Git-/Presence-*Outputs*, keine CM6-Features. Robustes, ehrliches Rendering aus den Mock-Zeilennummern statt pixel-genauem Ankleben an CM6-Glyph-Spalten (Akzeptanz = DOM/testid-Assert + Sicht-Abnahme). |
| Reduced-motion-Caret (R3) | **JS-Hook (`useReducedMotion`) flippt `data-reduced` + droppt die Blink-Animation** | angewendet | Playwrights `reducedMotion:reduce`-Config emuliert die Media-Query in diesem Chromium **nicht** für `matchMedia`/computed-styles (nur fürs Screenshot-Freezing). Der Test emuliert daher explizit via `page.emulateMedia({reducedMotion:"reduce"})` und prüft den Flip. Die globale `globals.css`-Reduced-motion-Regel bleibt zusätzlicher CSS-Fallback. |
| Default-Shell-Layout (R1) | **Kein Panel offen** (zentrierter Placeholder); Rail-Klick öffnet Panel | angewendet | Hält den Phase-0-Golden `shell-dark.png` gültig; Prototyp öffnet zwar Explorer default, aber „Placeholder behalten" (R1-Assignment) wiegt schwerer. |
| Diff-Datenform (R1) | **`DiffDoc`** (`{file, ext, added, removed, rows: DiffRow[]}`), abgeleitet aus `DiffStat` | angewendet | R0-Interfaces nannten nur `DiffStat`/`ChangeSet`; die Side-by-side-Zeilenstruktur (`shared.jsx` `DIFF`) braucht eine eigene Zeilenform. UI baut gegen `DiffDoc`, Mock `mockDiff` implementiert es. |
| Virtualisierung (R1) | **Eigenes `VirtualList`-Primitiv** (fixed-row windowing, keine neue Dep) | angewendet | Tischstakes verlangt Virtualisierung für lange Diffs/Listen; kein Virtualizer installiert, minimaler deterministischer Eigenbau statt neuer Abhängigkeit. |
| Transkript-Datenform (R2) | **`TranscriptBlock`** (`message` \| `tool` \| `permission`), geordnete Liste je Session via `AgentProvider.getBlocks()` | angewendet | Der Prototyp-Transcript verschachtelt Messages/ToolActions/PermissionPrompts in fester Reihenfolge; die R0-`Message[]`/`ToolAction[]`-Listen tragen keine Reihenfolge. `getBlocks` ist die geordnete Quelle; die alten Flach-Getter bleiben kompatibel. |
| Transkript-Virtualisierung (R2) | **`VirtualTranscript`** (variable-height windowing via ResizeObserver, keine neue Dep) | angewendet | Chat-Blöcke haben variable Höhe (Message vs. ToolAction vs. PermissionPrompt); `VirtualList` (fixed-row) passt nicht. Misst Höhen, cached sie im State, hält eine Offset-Tabelle. Deterministisch (Estimate → gemessen). 500-Block-Session `s4` als Gate. |
| Reduced-motion (global, R2) | **`@media (prefers-reduced-motion: reduce)`** in `globals.css` kollabiert alle Transitions/Animations | angewendet | Tischstakes §5; settled zugleich die Mount-Farb-Transition (Broker-Button-Anomalie, s.u.). |

## Offene Entscheidung — a11y color-contrast vs. JetBrains-Dark-Palette

Die Visual-Harness (axe) meldet `color-contrast`-Verstöße: die freigegebene Palette nutzt
bewusst **gedämpften Sekundärtext** (`--muted-foreground` `#868781`), der auf dunklem Grund
~3.82:1 erreicht — WCAG AA verlangt 4.5:1 für 12px-Text. Das ist eine reale Spannung
zwischen Design-Fidelity und a11y.

**Aktuell:** `color-contrast` ist **getrackt, nicht gegated** (im Visual-Test berichtet, alle
anderen serious/critical-Regeln bleiben harter Gate). Zu entscheiden in `road-to-design-primitives`:

1. **Token leicht anheben** (z.B. `--muted-foreground` → ~`#9a9b96`) → AA erfüllt, Look bleibt „dezent". (empfohlen)
2. **Muted-Look behalten**, color-contrast als dokumentierte, bewusste Abweichung (wie viele Pro-IDEs).
3. **Strikt AA überall** — größter Eingriff in die Ästhetik.

→ Offen für Produkt-Owner-Entscheidung. **Default angewendet:** `--muted-foreground`
`#868781` → `#9d9f96` (dark), erfüllt AA, „dezent"-Look bleibt. Reduziert die Violations
auf dem Foundation-Landing von 5 → 3.

**Anomalie GELÖST (R2, realer Broker-Prompt).** Diagnose im echten Agents-Modus: der
`bg-primary`-Button (PermissionPrompt-`Allow once`) zeigt direkt nach dem Mount kurz einen
falschen Teal- + hellen Textton, weil `transition-colors` (von `tailwindcss-animate`) die
Hintergrund-/Textfarbe vom Default-(Light-)Wert zum `.dark`-Wert **interpoliert** — ein
`getComputedStyle`-Read mitten in dieser Transition liefert den Zwischenwert
(rgb(46,149,137) statt rgb(62,182,168)). Die CSS-Kaskade ist korrekt: `--primary-foreground`
= `#0E1413` (dark) gewinnt; ein frisch eingefügtes Kind im PermissionPrompt löst
`hsl(var(--primary))` korrekt zu rgb(62,182,168) auf. Nach `transition:none` bzw. nach dem
Settling misst der Button rgb(62,182,168) auf rgb(15,20,19)-Text → guter Kontrast.

**Fix:** globale `@media (prefers-reduced-motion: reduce)`-Regel in `globals.css` kollabiert
Transitions/Animations (Tischstakes §5 — `prefers-reduced-motion` respektieren) und settled
damit auch die Theme-Farb-Transition sofort. Der Visual-Test
(`test/visual/agents.spec.ts`) verifiziert den **settled** Button-Zustand: dark
`primary-foreground`-Text auf Teal, Kontrast > 4.5:1. Kein Token-Bug — Transitions-Artefakt.

## Visual-Golden — Plattform-Notiz

Pixel-Goldens (`test/visual/**-snapshots/*.png`) sind **OS-spezifisch** (committed: darwin).
CI (Linux) fährt die OS-unabhängigen Gates (DOM/testid + axe); der Pixel-Golden ist lokaler
Dev-Gate. Ein Linux-Baseline (im Playwright-Container generiert) ist ein Follow-up.

## Test-Umgebungs-Notiz

Node 25 bringt ein experimentelles globales `localStorage` mit, das ohne
`--localstorage-file` nicht funktioniert und jsdoms überschattet. `src/test/setup.ts`
stubt deshalb einen deterministischen In-Memory-Storage.
