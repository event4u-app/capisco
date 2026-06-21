# Capisco — Roadmap-Overview (Master-Index)

*Stand: 2026-06-21. Track-Entscheidung: **UI-Shell zuerst** (Production-React-Shell,
Mock-Daten hinter echten Daten-Shape-Interfaces, kein echtes Backend). Quelle der Wahrheit:
`agents/tmp/package/00-konzept/capisco-konzept.md` (Warum), `02-build/build-spec.md` +
`build-plan.md` (Was/Reihenfolge), `01-design/design-system/` (Wie/Prototyp).*

Dieser Index ordnet die Roadmaps, hält die unverhandelbaren Invarianten, die Decision-Gates
(mit Defaults) und die **Verifikationsdoktrin** fest. Jede einzelne Roadmap ist eigenständig
ausführbar; diese Datei ist der Klebstoff.

---

## 0. Framing (ehrlich, einmal)

- **Mehrjahres-Tool, kein Stichtag.** Phasen lösen das *Zeit*-Problem (in jeder Phase ein
  nutzbares Tool), nicht das *Aufwands*-Problem. Selbsteinschätzung des Konzepts §15:
  „intellektuell exzellent, operativ überdehnt — Breite × Politur × Du+Claude Code: wähle zwei."
- **Der Prototyp ist eine *pixelgenaue Spec*, kein Code-Asset.** Er ist bespoke CSS-Klassen +
  `window.*`-Globals, **null** shadcn-Imports. „Härten statt Neubau" = **Übersetzung** der
  Komposition nach Tailwind/shadcn unter Wiederverwendung der **Tokens**, nicht der Zeilen.
- **15 % der Oberfläche = 90 % des Werts.** Der agent-native Kern (Agents-Modus, Broker-Prompt,
  Session-Tree) bekommt 100 % Politur; der Rest erbt/komponiert.
- **Reihenfolge ist wert-zuerst**, nicht infrastruktur-zuerst.

## 1. Roadmap-Reihenfolge

| # | Roadmap | Block | Status | Auto-verifizierbar? |
|---|---|---|---|---|
| R0a | `road-to-design-primitives` | Fundament | abgeschlossen (archiviert) | ja (Stories + Unit) |
| R0b | `road-to-app-foundation` | Fundament | abgeschlossen (archiviert) | ja (Infra-Selbsttest) |
| R1 | `road-to-chrome-shell` | Fundament | ausführbar | DOM-Assert + **Sicht-Abnahme** |
| R2 | `road-to-agents-mode` | **Differenzierer** | ausführbar | DOM-Assert + **Sicht-Abnahme** |
| R3 | `road-to-editor` | Differenzierer | strukturiert | DOM-Assert + **Sicht-Abnahme** |
| R4 | `road-to-git-near` | Git-Nähe | strukturiert | DOM + Mock-Seed-Assert |
| R5 | `road-to-dashboards-boards` | Breite | strukturiert | SVG-Struktur + **Sicht-Abnahme** |
| R6 | `road-to-tooling-breadth` | Breite | strukturiert | DOM + axe |

**Abhängigkeitsgraph:** R0a + R0b (parallel möglich, Interfaces zuerst) → R1 (enthält Diff +
Command-Palette) → R2 → R3 → R4 → R5 → R6. R0a/R0b sind harte Voraussetzung für alles.

**„Strukturiert"** = Goal + Phasen + Akzeptanz stehen; die feinen `- [ ]`-Schritte werden beim
Erreichen der Roadmap gefüllt (Fern-Detail jetzt verschiebt sich nur).

## 2. Unverhandelbare Invarianten (UI muss sie als *nicht-verhandelbar* darstellen)

Aus Konzept §3.2/§3.3 und §6 — **keine** Toggles, keine Grant-Achse:

1. **Secrets gelangen nie in den LLM-Context.** UI zeigt Secret immer als Referenz
   (`credential: staging-admin`), nie als Wert. (R2 Broker-Prompt, R6 Data.)
2. **Prod-Datasources sind read-only für *alle* Principals** (Mensch wie Agent). Kein
   „dauerhaft erlauben". Nur per-Befehl-einmalig. UI: `READ-ONLY`-Badge + Lock-Glyphen,
   nicht abschaltbar. (R6 Data.)
3. **Ehrlichkeit über Grenzen.** Code-Revert ≠ Seiteneffekt-Revert; LoC = Aktivität, nicht
   Leistung, nie Vergleich zwischen Nutzern; Query-Rollback ist kein echtes Undo. UI benennt
   die Grenze, statt Vollständigkeit vorzutäuschen. (R5 Git-Dashboard, R6 Data.)

## 3. Decision-Gates (Defaults gesetzt — Override jederzeit)

Diese hat der Council als „Agent kann nicht allein entscheiden" markiert. **Defaults aus
`build-plan.md` + Konzept abgeleitet; nichts blockiert das Bauen.** Override → hier ändern.

| Gate | Default | Quelle |
|---|---|---|
| **Shell-Träger** | **Vite-only Browser-App** (Tauri-Wrapper später; keine Tauri-APIs in der Shell, „Desktop"-Verhalten hinter Interface) | Track UI-Shell, Verifizierbarkeit |
| **Editor-Lib** | **CodeMirror 6** (read-only, Mock-Doc) | Konzept §5.6.6 „reife Basis erben" |
| **Overdue-Schwelle** | **7 Tage, konfigurierbar** (nicht 3) | build-plan §3 (Korrektur) |
| **Chat-Lesespalte** | **zentriert, ~740px** | build-plan §3 (Korrektur) |
| **Fonts** | **selbst hosten** (Inter + JetBrains Mono `.woff2` in `assets/fonts/`) | build-plan §5 |
| **Icons** | **Lucide** (als npm-Dep, inline gebündelt — kein CDN) | Design-Readme |
| **Brand-Mark** | **Platzhalter** `capisco-mark.svg` weiterverwenden | build-plan §5 |
| **Komponenten-Quelle** | **`_shadcn/` ist kanonisch**; In-Browser-`components/` = nur Mock-Spiegel | build-plan §1 |
| **i18n-Default-Sprache** | **Englisch** (UI-Strings), Schicht ab Tag 1 | Konzept §5.9 |

## 4. Verifikationsdoktrin (der Autonomie-Enabler — R0b baut sie)

Eine IDE-UI verifiziert man **visuell** — sonst behaupte ich „done" ohne Beweis. Naives
„Prototyp live screenshotten und Pixel-diffen" ist **unsolide** (CDN-Fonts, async Lucide-Inject,
Babel-Race, Pulse/Blink-Loops). Stattdessen, in R0b einmalig gebaut:

1. **Eingefrorene Offline-Goldens.** Prototyp einmal headless rendern — Fonts + Icons + Settle
   abwarten — pro Modus/Theme als PNG einfrieren und committen. Spätere Roadmaps diffen gegen
   **diese Dateien**, nie gegen einen Live-Render.
2. **Determinismus erzwingen:** Fonts self-hosted, Icons inline, `prefers-reduced-motion`,
   Pulse/Blink/Caret per CSS einfrieren, fester Viewport 1440×880 + DPR, volatile Regionen
   maskieren (Token-Zahlen, Laufzeiten wie `2m 49s`), **deterministischer Mock-Seed**.
3. **Drei Beweis-Ebenen (nicht nur Pixel):**
   - **(a) DOM/Struktur-Assertions** auf `data-testid` (Grid-Spalten, Panel-Breiten 260/340,
     Statusleisten-Reihenfolge, Broker-Block vorhanden) — **robust, der eigentliche Autonomie-Enabler**.
   - **(b) Component-Stories** (Storybook/Ladle), pro Primitiv gescreenshottet — kleine, stabile Fläche.
   - **(c) Pixel-Diff** mit Toleranz — **Stolperdraht**, nicht Gate.
   - Verdikt = (a) grün **und** (c) < Schwelle; mehrdeutig → für menschliche Abnahme flaggen.
4. **Ehrlich:** R1–R3 + R5 (Fidelity-Flächen) sind **nicht** voll auto-verifizierbar. Struktur +
   Stories heben den Boden; Pixel-Geschmack braucht eine menschliche Abnahme. Das steht in der
   jeweiligen Akzeptanz und ist kein „done" ohne Dein OK.

## 5. Tischstakes — in *jede* Roadmap eingepreist (≈ 50–60 % des realen Aufwands)

Im Prototyp unsichtbar, in Produktion Pflicht. Akzeptanzkriterium jeder UI-Roadmap:

- **Tastatur + Fokus-Management** (Tab-Order, Fokusfallen für Popups/Flyouts, sichtbare Focus-Rings).
- **Command-Palette-Eintrag** für jede neue Aktion (Eskalationsleiter, §5.6.6).
- **Leer-/Lade-/Fehler-Zustände** für jede Datenfläche.
- **Virtualisierung** für schwere Listen (Dateibäume, Suche, lange Diffs, Chat-Transkripte).
- **i18n** — alle sichtbaren Strings über die i18n-Schicht, keine hartcodierten.
- **a11y** — axe-core grün, ARIA-Rollen, Kontrast, Screenreader-Semantik.
- **`prefers-reduced-motion`** respektiert.

## 6. Daten-Shape-Interfaces (in R0a definiert — UI baut *nur* dagegen)

Die UI baut gegen Interfaces, die später auf echte Provider mappen; Mocks *implementieren* sie,
ersetzen sie nicht (build-plan §4). Mindestens:

- **Agents:** `Session`, `Message`, `ToolAction`, `PermissionRequest`, `SubAgent`, `BackendConfig`.
- **Explorer/Changes:** `Project`, `FileNode`, `DiffStat`, `ChangeSet`, `CompareBranch`.
- **Git-Dashboard:** `PullRequest`, `Metric`, `AwarenessEntry`, `WorkHeatmapCell`.
- **Tasks:** `Ticket`, `Epic`, `Sprint`, `BurndownSeries`.
- **Editor-Provider-Outputs (R3):** `CompletionItem`, `InlayHint`, `BlameLine`, `PresenceMarker`.
- **Tooling:** `Datasource`/`Table` (mit `readonly`-Flag), `Container`/`ServiceStat`, `SignalItem`.

Provider-Output-Surfaces sind **nie** Editor-/Screen-Features, sondern Mock-Provider hinter
diesen Interfaces (Council-P1).

## 7. Konzept-Flächen, die nicht verloren gehen dürfen

Vom Council als „still gedroppt" markiert — verankert in:

- **Geteilte Signal-Fläche** (§5.2) — *eine* Benachrichtigungsschiene (PR/Container/Observability) → R6.
- **Presets/Sichtbarkeit** (§5.4) — Icons ein-/ausblendbar, „ausgeblendet ≠ deaktiviert", über
  Command-Palette auffindbar → R1 (an Activity-Bar-Dock + Palette gekoppelt).
- **Historien/Scrubber** (§5.1) — datei-fein (2) + projekt-grob (3) als *ein* Scrubber → benannt,
  Detail später (braucht echtes Git, post-Shell).
- **Ehrlichkeits-UI** (§6) — Grenzen benennen → R5/R6 Akzeptanz.

## 8. Arbeitsweise / Autonomie-Vertrag

- Jede Roadmap wird in **wert-zuerst-Reihenfolge** abgearbeitet; Checkbox-Flip pro fertigem +
  verifiziertem Schritt.
- **„Done" = Code geschrieben UND die in der Akzeptanz genannte Verifikation ist frisch grün.**
- Fidelity-Roadmaps (R1–R3, R5) enden mit einer **expliziten Sicht-Abnahme-Bitte** an Dich,
  bevor sie als geschlossen gelten.
- Decision-Gates (§3) haben Defaults — ich baue mit dem Default weiter und flagge nur, wenn ein
  Gate die Arbeit *wirklich* blockiert.
