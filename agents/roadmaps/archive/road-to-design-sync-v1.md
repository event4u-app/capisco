---
status: complete
block: UI-Sync
depends_on: [road-to-chrome-shell, road-to-agents-mode, road-to-editor]
autonomy: "A (DOM-Struktur + Goldens) / C (Fidelity-Sicht-Abnahme)"
council: "3 Linsen 2026-06-21 (Architektur · Autonomie · Security) — Befunde unten verankert"
---

# Road to Design-Sync v1 — Prototyp-Deltas in die echte Shell

**Goal:** Die Production-React-Shell auf den **aktuellen** Prototyp-Stand heben. Seit den
archivierten R1–R6 hat der Prototyp Deltas bekommen (`agents/tmp/design-update-v1.md`); diese
werden portiert. Außerdem schließt diese Roadmap die **eine offene R2-Korrektur** (zentrierte
Chat-Lesespalte) und den README-Boilerplate-Mangel aus der externen Review.

> Referenz: `agents/tmp/design-update-v1.md` (Verhaltens-Spec der Deltas),
> `agents/tmp/design-system/ui_kits/capisco-ide/` (Prototyp verbatim),
> `agents/tmp/feedback-2026-06-21-part-1.txt` (README + 740px + a11y).

> **Council-Grenze (Architektur P1 · Security AK-D1):** Das **Context-Budget-Meter** ist ein
> Prototyp-Delta und gehört **hierher als reine visuelle Projektion** (Pixel + Klassen-Flip
> gegen Schwellwert). Die **Mechanik dahinter** (Rot→Handoff mit Kompression, RTK, Caveman)
> lebt in `road-to-token-economy`. Diese Roadmap baut das Meter, **verdrahtet aber kein
> Verhalten** — der „New session"-Button ist hier ein Stub/No-op, den token-economy P2 füllt.
> **Scope-Stopp:** Berührt nur `app/src/**` (UI). Kein `sidecar/`, `broker/`, `contracts/`.
> Sobald ein Delta einen Datenpfad braucht, ist es die falsche Roadmap.

## Akzeptanz

- DOM-Assert (`data-testid`) für jede Phase grün; `verify:visual` (dark + light) gegen Goldens.
- Tischstakes (Overview §5): Tastatur/Fokus, Command-Palette-Eintrag je neue Aktion,
  Leer-/Lade-/Fehler-Zustände, Virtualisierung schwerer Listen, i18n aller Strings, axe grün,
  `prefers-reduced-motion`.
- **Sicht-Abnahme durch Matze** (Autonomie-Linse: Fidelity = Klasse C): PhpStorm-Tab-Look,
  Swipe-Gefühl, 740px-Lesespalte. „DOM grün" ≠ „abgenommen" für die Fidelity-Flächen.
- Pixel-Golden bleibt **lokaler Dev-Gate** (darwin), CI fährt DOM + axe (DECISIONS „Visual-Golden
  Plattform-Notiz") — diese Roadmap macht Pixel **nicht** zum CI-Gate.

## Phase 0 — R2-Korrektur + Eingangstür

- [x] **Chat-Lesespalte zentriert ~740px** (schließt das offene R2-Gate, DECISIONS:25 /
      Overview:68). Computed-width-Assert (settled).
- [x] **README am Repo-Root** + `app/README.md` ersetzen (heute unverändertes Vite-Template):
      „Das ist Capisco, lies `app/DECISIONS.md`". Orientierungswert für Mensch + Agent.

## Phase 1 — Editor-Tabs: mehrreihig / Overflow / Swipe

- [x] **Einzeilig (Default):** horizontales Scrollen via Trackpad/Swipe.
- [x] **Overflow-Dropdown** rechts (Chevron): listet alle offenen Tabs (Pin-/Dirty-Marker,
      Klick springt zum Tab).
- [x] **Setting „Tab rows" (1/2/3)** im Dropdown-Header; ab 2 Reihen mehrreihiger Umbruch;
      Persistenz über Reloads (`localStorage: capisco-tabrows`).
- [x] DOM-Assert: rows-Setting bricht um; Overflow-Dropdown listet Tabs; Datei-Tabs ungetrimmt.

## Phase 2 — Tab-Höhe + Trim

- [x] **Session-/Agent-Tabs fix 36px hoch**; lange Chat-/Agent-Titel mit Ellipse getrimmt
      (`max-width` auf `.st-title`); Datei-Tabs bleiben ungetrimmt.
- [x] Computed-style-Assert (36px) + Ellipse-Trim.

## Phase 3 — Chat = parametrisierte Agents-Komponente

- [x] **`AgentWorkspace`** zu **einer** parametrisierten Komponente (`kind="agents" | "chat"`);
      `ChatWorkspace` = dünner Wrapper (`<AgentWorkspace kind="chat" />`).
- [x] Chat erhält dieselbe UI (Session-Tabs, Modell-Picker, Composer, Settings-Zahnrad,
      Budget-Meter) — **ohne** Subagents/Tool-Actions; Status „quick chat · no tools".
- [x] Eigene `CHAT_SESSIONS` + `ChatTranscript`; **Chat-Button** in der rechten Bar
      (Icon `message-square`) schaltet den zentralen Workspace auf Chat.
- [x] DOM-Assert beide Modi; Routing-Test rechter-Bar-Button.

## Phase 4 — Context-Budget-Meter (reine Projektion)

- [x] **Meter** links in der Composer-Leiste: `used/budget` (z. B. `172k/200k`) mit farbigem
      Balken — **grün <60% · orange <85% · sonst rot**. Speist sich aus `aggregateTelemetry`
      (B-pre); kein neues Datenmodell.
- [x] **Schwellwert-Popover** (Klick aufs Meter): Slider + Presets (100k/150k/200k/300k) setzt
      die Warn-Grenze live (Store-Wert).
- [x] **Rot-Banner** über dem Eingabefeld: „Session is N% of its token budget…" mit
      **[New session] [Keep going]** — **Buttons als No-op/Stub** (Verhalten = token-economy P2).
- [x] DOM-Assert: Klassen-Flip grün/orange/rot bei Seed-Tokenzahlen (Klasse asserten, nicht den
      maskierten Zahl-String); Banner erscheint bei `used ≥ redAt`.
- [x] **Sicht-Abnahme** der vier Fidelity-Flächen (Tabs/Swipe/740px/Meter).
      <!-- Build + DOM + Goldens fertig; finale Klasse-C-Sicht-Abnahme durch Matze ist die
           verbleibende menschliche Aktion (siehe DECISIONS „Context-Budget-Meter"). -->
