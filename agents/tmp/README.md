# Capisco — Projektpaket

Agent-native, schlanke IDE. Dieses Paket bündelt **alles** an einem Ort: die Vision, das
Design-System (Prototyp), und die Bau-Anweisung — inklusive der offenen Punkte.

*Stand: Juni 2026. Sprache: Konzept/Plan auf Deutsch, Build-Spec + Design-System auf
Englisch.*

---

## Was Capisco ist (eine Zeile)

Eine **agent-native Desktop-IDE** (Tauri, JetBrains-New-UI/PhpStorm-Dark-Ästhetik), deren
Herzstück ein paralleles Multi-Agent-System (**Session-Tree**) in isolierten
**Worktree-Workspaces** ist, mediiert durch einen **Capability-Broker**. *Capisco* =
italienisch „ich verstehe" — die Antwort auf den Markt-Schmerz „fast richtig, aber nicht
ganz": Grounding statt Halluzination.

---

## Paketstruktur & Lesereihenfolge

```
capisco-package/
├── README.md                          ← dieses Dokument (Index)
│
├── 00-konzept/
│   └── capisco-konzept.md             ← DAS WARUM. Vision & Architektur.
│
├── 01-design/
│   ├── capisco-design-brief.md        ← DAS WIE (Pixel). Hero-Screen-Brief.
│   └── design-system/                 ← DER PROTOTYP. Tokens, Komponenten, UI-Kit, Produktion.
│       ├── readme.md                  · der Design-Guide (zuerst lesen)
│       ├── SKILL.md                   · Agent-Skills-Einstieg
│       ├── styles.css                 · die eine Datei, die Konsumenten einbinden
│       ├── tokens/                    · Farben, Syntax, Typo, Spacing, Motion (dark + light)
│       ├── components/                · in-browser-Primitive (Mock-Spiegel)
│       ├── guidelines/                · Foundation-Specimen-Cards
│       ├── ui_kits/capisco-ide/       · der Hero-Screen (interaktiv, dark/light)
│       ├── _shadcn/                   · PRODUKTIONS-Quelle (Radix+Tailwind+cva)
│       ├── assets/                    · Brand-Mark (Platzhalter)
│       └── uploads/                   · Render-Screenshots (Referenz)
│
└── 02-build/
    ├── build-spec.md                  ← DAS WAS (Oberfläche). Handoff für Claude Code.
    └── build-plan.md                  ← DAS TODO. Phasen, Korrekturen, Lücken. ZUERST LESEN.
```

**Empfohlene Lesereihenfolge:**
1. `00-konzept/capisco-konzept.md` — warum es das gibt, die drei Primitive, der Broker,
   die Provider, die wert-zuerst-Roadmap.
2. `01-design/design-system/readme.md` — wie es aussieht/klingt, die Design-Entscheidungen.
3. `01-design/design-system/ui_kits/capisco-ide/index.html` — der Prototyp im Browser
   (im Zweifel: hier nachsehen und matchen).
4. `02-build/build-plan.md` — **vor** dem Bau lesen: was die Spec auslässt und in welcher
   Reihenfolge gebaut wird.
5. `02-build/build-spec.md` — die detaillierte Oberflächenbeschreibung.

---

## Die drei Ebenen — und ihr Status

| Ebene | Datei | Status |
|-------|-------|--------|
| **Konzept** (Warum) | `00-konzept/` | vollständig, referenzierbar |
| **Design** (Wie) | `01-design/` | Prototyp + Produktions-Quelle (`_shadcn/`) vorhanden |
| **Build** (Was/Todo) | `02-build/` | Spec = UI-Shell; Plan listet die Backend-Lücken |

---

## Wichtigste Hinweise vor dem Bau (Kurzfassung von `build-plan.md`)

- **Die Build-Spec beschreibt die UI-Shell, nicht das Produkt.** Daten, State, IPC, ACP,
  echte Broker-/Worktree-Logik fehlen bewusst. Dieser Pass baut die Hülle, dann wird
  verdrahtet.
- **`_shadcn/` ist die Produktionsquelle**, die in-browser-`components/` sind nur der
  Mock-Spiegel. Keine dritte Ebene erfinden.
- **Härten statt Neubau.** Komposition des Prototyps auf `_shadcn/`-Primitive heben.
- **Phasen, nicht Monolith.** Pass 1 = Chrome + Editor + Agents (der Differenzierer) zuerst
  und vollständig; Dashboards/Boards danach als eigene Aufträge.
- **Zwei Korrekturen:** Overdue-Schwelle **7 Tage, einstellbar** (nicht 3, nicht fest);
  Chat-Spalte **zentriert** ~740px (Spec schlägt Prototyp-Zustand).
- **Von Tag eins:** Daten-Shape-Verträge, i18n, Tastatur/Command-Palette, Leer-/Lade-/
  Fehler-Zustände + Virtualisierung.
- **Platzhalter ersetzen:** Brand-Mark, Fonts selbst hosten, ggf. eigenes Icon-Set.

---

## Herkunft

Konzept und Design entstanden in einer iterativen Sitzung. Das Konzeptdokument ist die
kanonische Quelle für *was das Produkt ist und warum*; das Design-System ist die kanonische
Quelle für *wie es aussieht*; bei Konflikt zwischen Prosa-Spec und Prototyp gewinnt die Spec,
bei Konflikt zwischen Build-Spec und Konzept gewinnt das Konzept (siehe die Korrekturen in
`build-plan.md`).
