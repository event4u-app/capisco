---
status: complete
block: Fundament
depends_on: []
unlocks: [road-to-design-primitives, road-to-chrome-shell]
---

# Road to App-Foundation (R0)

**Goal:** Ein lauffähiges Vite+React+TS-Projekt mit Capisco-Theme, i18n, CI, der
**Daten-Shape-Interface-Schicht + deterministischen Mock-Providern** und vor allem der
**eingefrorenen Offline-Visual-Verify-Harness** — dem Fundament, das jede spätere Roadmap
selbst-verifizierbar macht. Kein Feature-UI, nur das Gerüst.

> **Abgeschlossen 2026-06-21.** Alle 6 Phasen grün; Harness tripwire-getestet (bewusster
> CSS-Bruch wird rot, Revert grün). App unter `app/`. Eine offene Owner-Entscheidung:
> a11y color-contrast vs. Palette (siehe `app/DECISIONS.md`, getrackt für R0-Primitive).

## Akzeptanz (auto-verifizierbar — Infra)

- [x] `pnpm typecheck && pnpm lint && pnpm test` grün; `pnpm build` erzeugt ein Bundle.
- [x] `pnpm verify:visual` rendert die App headless, vergleicht gegen committeten Golden + DOM-Assert + axe; Tripwire bei Bruch verifiziert.
- [x] Ladle startet/baut; Primitive (Button, StatusDot, PermissionPrompt) haben je eine Story.
- [x] `prefers-reduced-motion` + dark-canonical + light-toggle nachweisbar (Test + DOM-Assert).

## Phase 0 — Scaffold & Tooling

- [x] Vite + React 19 + TypeScript (strict) unter `app/`; pnpm. **Shell-Träger = Vite-only** (Tauri später). Siehe `app/DECISIONS.md`.
- [x] Tailwind v3 + `tailwindcss-animate`; `tailwind.config.ts` + `src/styles/globals.css` (dark = `.dark` kanonisch); Tokens übernommen.
- [x] `_shadcn` lib/utils + `components/ui/*` (7) + `components/capisco/*` (3) nach `src/`; `@/`-Alias.
- [x] ESLint + Prettier; Vitest + Testing-Library; pnpm-Scripts (dev/build/typecheck/lint/format/test/verify:visual/ladle).

## Phase 1 — Assets self-hosted & deterministisch

- [x] **Fonts self-hosted:** Inter + JetBrains Mono via `@fontsource/*` (kein CDN).
- [x] **Icons inline:** `lucide-react` + `src/components/icon.tsx` (linear, 1.6px, monochrom).
- [x] **Brand-Mark:** `capisco-mark.svg` + `-teal.svg` Platzhalter in `src/assets/`.
- [x] Theme-Provider (`src/lib/theme.tsx`, dark default, light-Toggle, localStorage) + `useReducedMotion`.

## Phase 2 — i18n-Schicht (ab Tag 1)

- [x] react-i18next (`src/i18n/`); `en`-Default; App nutzt nur `t()` (keine hartcodierten Strings).
- [x] Smoke-Test (`src/i18n/i18n.test.ts`) erkennt fehlende Übersetzungen.

## Phase 3 — Daten-Shape-Interfaces + Mock-Provider

- [x] `src/contracts/` (agents, workspace, editor, tooling) — getypt aus den Prototyp-Shapes.
- [x] `src/mocks/` — Provider implementieren die Interfaces, deterministischer Seed; Test prüft Determinismus.
- [x] Editor-Provider-Outputs als eigene Contracts (Council-P1).

## Phase 4 — Verify-Harness (der Autonomie-Enabler)

- [x] Ladle (`.ladle/`) als Story-Explorer; `data-testid`-Konvention dokumentiert (`app/test/README.md`).
- [x] Golden-Mechanismus etabliert (Playwright `toHaveScreenshot`, deterministisch: Fonts self-hosted, Motion aus, 1440×880). *Hinweis:* Prototyp-Screen-Goldens werden pro Screen in R1+ eingefroren — das Fundament hat (noch) keinen Prototyp-äquivalenten Screen; der Foundation-Golden ist committet.
- [x] **`verify:visual`-Playwright:** DOM/testid-Assertions (Primär-Gate) + Pixel-Golden (Tripwire, getestet) + axe.
- [x] axe-core in der Suite (color-contrast getrackt statt gegated — Owner-Entscheidung offen, `DECISIONS.md`).

## Phase 5 — CI & Decision-Gate-Doc

- [x] CI-Pipeline (`.github/workflows/ci.yml`): quality-Job (typecheck/lint/format/test/build/ladle) + visual-Job (DOM+axe, OS-unabhängig; Pixel-Golden darwin-lokal, Linux-Baseline = Follow-up).
- [x] `app/DECISIONS.md` mit Gates + offener color-contrast-Entscheidung + Plattform-Notiz.

## Council-Notizen

- R0 **vor** Primitiven/Shell — halb-fertige Primitive sind das größte versteckte Risiko (Reviewer 2).
- Harness gegen *eingefrorene Dateien*, nie Live-CDN-Render (Reviewer 3); Primär-Beweis = DOM-Assertions, Pixel nur Tripwire. **Bewährt:** axe fing sofort die color-contrast-Spannung der Palette.
- „Härten" = Übersetzung; Tokens wiederverwenden, Prototyp-CSS-Klassen nicht (Reviewer 2).
