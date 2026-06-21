# Design-Brief für Claude Design — Capisco IDE (Hero-Screen)

**Ziel:** Ein hochauflösendes, statisches Mockup des Haupt-Arbeitsfensters einer
agent-nativen Desktop-IDE namens **Capisco**. Dark Theme. Referenz-Ästhetik: JetBrains
New UI / PhpStorm Dark — dicht, geordnet, ruhig, *nicht* überladen. Es ist ein
Desktop-App-Fenster (kein Browser-UI, keine Marketing-Seite).

> **Wichtig:** Das ist eine Entwickler-IDE, kein verspieltes Produkt. Zurückhaltend,
> professionell, informationsdicht aber ruhig. Akzentfarbe sparsam einsetzen. Keine
> Verläufe, keine Schatten-Spielereien, keine runden „SaaS"-Karten. Flächen werden durch
> minimale Helligkeitsunterschiede getrennt, nicht durch dicke Rahmen.

---

## 1. Gesamtlayout (Zonen)

Ein randloses Desktop-Fenster (macOS-Stil, Ampel-Buttons oben links). Von außen nach
innen:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ TITELLEISTE (40px): ● ● ●   Capisco-Logo  Projekt ▾   ⎇ branch ▾   …   ⚙   │
├──┬────────────────────┬──────────────────────────────┬───────────────────┬──┤
│  │                    │  TAB-LEISTE                  │                   │  │
│L │  LINKES PANEL      ├──────────────────────────────┤  RECHTES PANEL    │R │
│  │  (Datei-Explorer)  │                              │  (AGENT / Session │  │
│A │                    │  EDITOR                      │   -Tree) ★ STAR   │A │
│c │   ~260px           │  (flex, größte Fläche)       │   ~360px          │c │
│t │                    │                              │                   │t │
│i │                    │                              │                   │i │
│v │                    ├──────────────────────────────┤                   │v │
│- │                    │  BODENPANEL (Terminal)       │                   │- │
│B │                    │  ~200px hoch                 │                   │B │
├──┴────────────────────┴──────────────────────────────┴───────────────────┴──┤
│ STATUSLEISTE (26px): breadcrumb · PHP 8.3 · ⎇ · Blame · 12:4 · LF · UTF-8 …│
└───────────────────────────────────────────────────────────────────────────┘
```

- **Zwei schmale Activity-Bars** ganz links und ganz rechts (je ~48px), nur Icons mit
  winzigem Label darunter. Das jeweils aktive Icon dezent hervorgehoben (leicht hellerer
  Hintergrund + Akzent-Strich links/rechts, *nicht* grell).
- **Linkes Panel:** Datei-Explorer (Default-Ansicht).
- **Editor mittig:** größte Fläche, mit Tab-Leiste oben.
- **Bodenpanel:** Terminal, unter dem Editor, zusammenklappbar.
- **Rechtes Panel:** der **Agent-/Session-Tree** — das ist das Herzstück, hier am meisten
  Sorgfalt (Details unten in §6).
- **Statusleiste:** dünn, informationsdicht, unten über volle Breite.

---

## 2. Farb-Tokens (Dark Theme)

| Rolle | Hex | Einsatz |
|-------|-----|---------|
| Editor-Hintergrund | `#1E1F22` | Editor, Tab-Inhalt |
| Tool-Window-Hintergrund | `#2B2D30` | Panels, Activity-Bars, Statusleiste |
| Erhöhte Fläche / Eingabe | `#1C1D20` | Eingabefelder, Terminal |
| Rahmen / Trenner | `#393B40` | sehr subtil, 1px |
| Primärtext | `#DFE1E5` | Code, Labels |
| Sekundärtext | `#868781` | Pfade, Hints, inaktive Tabs |
| Tertiär / disabled | `#5A5D63` | sehr zurückgenommen |
| **Akzent (Teal)** | `#3FB6A8` | aktive Zustände, Links, Fokus, Fortschritt — **sparsam** |
| Akzent gedämpft | `#2C6E68` | Akzent-Hintergründe, Tints |
| Diff added / Erfolg | `#4FA85A` | grüne Zeilen, „erledigt" |
| Diff removed / Fehler | `#D16E6E` | rote Zeilen, Fehler |
| Warnung | `#D8A65C` | Hinweise, „wartet" |

Syntax-Highlighting im Editor in gedämpften Tönen (kein Neon): Keywords sanftes
Violett/Blau, Strings gedämpftes Grün, Kommentare grau-kursiv, Zahlen sanftes Orange.

---

## 3. Typografie & Dichte

- **UI-Chrome:** serifenlose System-Sans (Inter o. ä.), 12–13px, kompakt.
- **Editor & Terminal:** Monospace (JetBrains Mono o. ä.), 13px, Zeilenhöhe ~1.5.
- **Dichte:** hoch, aber atmend. Listenzeilen ~24–28px hoch. Padding knapp, konsistent
  (4/8/12px-Raster). Sekundärinfo (Pfade, Token-Zahlen) konsequent kleiner + grau.

---

## 4. Titelleiste (40px, `#2B2D30`)

Links: macOS-Ampel · kleines **Capisco**-Logomark (schlicht, monochrom/teal) ·
Projekt-Dropdown „**capisco**" mit ▾ · Branch-Indikator „⎇ main" mit ▾.
Rechts: Run-/Debug-Icons (▷ ⛟) · Run-Config-Dropdown „Dev" · Such-Icon (⌕) ·
More (⋯) · Settings (⚙). Alles monochrom-grau, Hover → leicht heller.

---

## 5. Linkes Panel — Datei-Explorer (~260px, `#2B2D30`)

- Kopf: „PROJECT" in Caps, klein, grau, mit ein paar Mini-Icons rechts (collapse, refresh).
- Baum mit Dateityp-Icons, Einrückung, Aufklapp-Pfeilen. Realistischer Inhalt, z. B.:
  - `▾ capisco`
    - `▾ src`
      - `▾ core` → `worktree.ts`, `session-tree.ts`, `broker.ts`
      - `▾ providers` → `language-pack.ts`, `task-provider.ts`, `quality.ts`
      - `▸ ui`
    - `▾ src-tauri` → `main.rs`, `lib.rs`
    - `package.json`, `README.md`
- Git-Status-Marker rechts an geänderten Dateien: `M` (teal/orange), `A` (grün) — dezent.
- Eine Datei als aktiv markiert (heller Hintergrund + Akzent-Strich links), passend zum
  offenen Editor-Tab.

---

## 6. ★ Rechtes Panel — Agent / Session-Tree (~360px) — DAS HERZSTÜCK

Hier liegt die ganze Differenzierung. Es zeigt mehrere parallele KI-Sessions als Baum,
mit Live-Überwachung. Aufbau von oben nach unten:

**Kopfzeile:** „AGENTS" (Caps, klein, grau) + rechts ein `+`-Button („Neue Session") und
ein Filter-Icon.

**Session-Liste (Baum):** 2–3 Sessions, eine davon mit Subagents eingerückt. Jede
Session-Zeile zeigt:
- Status-Punkt links: grün-pulsierend = läuft, grau = idle, teal = wartet auf Freigabe.
- Modell-Badge: „Claude", „GPT-5", „Local" (kleines monochromes Label).
- Titel der Session (z. B. „Implement worktree teardown").
- Rechts: Laufzeit (`2m 49s`) + Tokenzahl (`6.5k ↓`) in grau-monospace.

Konkreter Beispiel-Inhalt:

```
● Claude · Implement worktree teardown        2m 49s · 6.5k ↓
  └ ● Claude · Subagent: write tests          0m 31s · 1.2k ↓
○ GPT-5 · Refactor broker grant model         idle  · 18k ↓
◐ Local · Search: "where is port allocated?"  wartet auf Freigabe
```

**Aktive Session (aufgeklappt, unten):** Eine Session ist expandiert und zeigt einen
kompakten Chat-/Verlauf-Bereich:
- Abwechselnd User- und Agent-Nachrichten (kompakt, monospace-Akzente für Code).
- Pro Nachricht beim Hover: kleine Icons retry / copy / branch.
- Eine **Tool-Aktion** als eigener Block, z. B.:
  `▸ Edit  src/core/worktree.ts  (+12 −4)` mit grün/rot-Zahlen.
- Ein **Permission-Prompt** als hervorgehobener Block (das ist der Capability-Broker!):
  > 🔒 `Bash(rm -rf .worktrees/tmp)` — Freigabe nötig
  > [ Einmal ]  [ Diese Session ]  [ Ablehnen ]
  (Teal umrandet, ruhig, nicht alarmistisch.)
- Unten ein Eingabefeld „Nachricht an Capisco…" mit Modell-Auswahl-Dropdown links und
  Senden-Pfeil rechts.

**Footer der Session:** kleine Live-Leiste „Tokens: 6.5k · Kosten: $0.04 · läuft 2m49s".

---

## 7. Editor-Bereich (mittig)

**Tab-Leiste** (`#2B2D30`, ~36px): mehrere Tabs nebeneinander, jeweils Dateityp-Icon +
Name + Schließen-x beim Hover. Ein Tab **gepinnt** (Pin-Icon statt x, etwas schmaler,
links). Aktiver Tab: `#1E1F22`-Hintergrund (= Editor-Farbe, „verschmilzt" mit Editor) +
1px Akzent-Strich oben. Inaktive Tabs grau. Beispiel-Tabs:
`📌 worktree.ts` · `broker.ts` (aktiv) · `session-tree.ts` · `README.md`

**Editor-Fläche** (`#1E1F22`):
- Gutter links: Zeilennummern (grau), Git-Marker (teal/grün Balken an geänderten Zeilen),
  Folding-Pfeile.
- Echter, plausibler TypeScript-Code (z. B. eine `Broker`-Klasse mit einer
  `checkCapability(principal, capability, scope)`-Methode).
- **Rainbow-Brackets:** verschachtelte Klammern in gestaffelten Farben (gedämpft:
  teal → violett → sanftes orange → grau, nicht knallig).
- **Vertikale Einrückungs-Hilfslinien** (sehr subtil, `#393B40`), die aktive Einrückung
  einen Tick heller.
- Eine Zeile mit Cursor + dezenter Zeilen-Highlight.
- Eine **Autocomplete-Popup** offen: kleines Dropdown mit 4–5 Vorschlägen, Icons je
  Symboltyp (Methode/Variable), erster Eintrag teal-hinterlegt, rechts ein Typ-Hint grau.
- Rechts oben im Editor: kleine Mini-Map-Andeutung optional, sonst weglassen.

---

## 8. Bodenpanel — Terminal (~200px, `#1C1D20`)

- Tab-Leiste über dem Terminal mit **umbenennbaren Tabs**: `Local` · `Py2Ts` ·
  `Evidence` (aktiv) · `+`. Aktiver Tab teal-Unterstrich.
- Terminal-Inhalt: Monospace, ein paar Zeilen plausibler Output (ein `pnpm test`-Lauf mit
  grünen ✓), zuletzt eine Eingabezeile mit Prompt `~/capisco ❯ ` und blinkendem Cursor.
- Links neben der Tab-Leiste kleine Icons: Split, Trash, Settings (grau).

---

## 9. Statusleiste (26px, `#2B2D30`)

Volle Breite, dünn, alles 11–12px grau, Hover → heller. Felder von links nach rechts:
`capisco › src › core › broker.ts` (breadcrumb) ··· (Mitte frei) ··· rechtsbündig:
`PHP 8.3` · `⎇ main ↑2` · `Blame: matze 2d ago` · `Ln 24, Col 8` · `LF` · `UTF-8` ·
`2 spaces` · `✓ Capisco` (kleines Logo). Trenner als schmale Lücken, keine Striche.

---

## 10. Activity-Bars (je ~48px)

**Links** (Icons + winziges Label): Explorer (aktiv), Commit, PR, Search, Structure,
Database, Problems, Terminal. **Rechts:** Agents (aktiv), Chat, Notifications,
Inspections. Aktives Icon: leicht hellerer Hintergrund + 2px Teal-Strich an der
Außenkante. Icons schlicht/linear (Lucide-Stil), monochrom-grau, aktives in Teal.

---

## 11. Was zu vermeiden ist

- Keine bunten Verläufe, keine großen Schatten, keine runden „Karten" mit viel Weißraum.
- Akzent-Teal nur für aktive/wichtige Zustände — nicht flächig.
- Nicht jedes Element rahmen; Flächen über Helligkeit trennen.
- Keine Marketing-Sprache, keine Emojis im UI (außer die genannten funktionalen
  Schloss-/Status-Symbole, und auch die dezent).
- Dichte halten: lieber kompakt und ruhig als luftig und verspielt.

---

## 12. Optional — zweite Variante

Falls leicht machbar: dieselbe Ansicht zusätzlich als **Light Theme** (dieselben
Token-Rollen invertiert: Editor `#FFFFFF`/`#FAFAFA`, Tool-Window `#F2F3F5`, Text dunkel,
Teal-Akzent bleibt). Zeigt, dass das Design token-getrieben ist.
