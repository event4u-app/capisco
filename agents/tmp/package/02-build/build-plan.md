# Capisco — Build-Plan & offene Punkte

*Ergänzung zur `build-spec.md`. Hält fest, was die Spec auslässt, was zu korrigieren ist
und in welcher Reihenfolge gebaut wird. Vor der Übergabe an Claude Code zuerst lesen.*

---

## 0. Das wichtigste Framing

Die `build-spec.md` ist trotz ihres Titels ein **UI-Shell-Spec**, kein vollständiger
Build-Spec. Sie beschreibt zu ~100 % *Aussehen und Verhalten* der Oberfläche — und mit
keinem Wort, **woher die Daten kommen**: kein State-Management, kein Datenfluss, keine
Tauri↔Sidecar-IPC, keine ACP-Anbindung, keine echte Session-/Worktree-/Broker-Logik.

> **Konsequenz:** Gibt man die Spec unverändert an Claude Code, entsteht eine schöne,
> *statische* React-UI mit Mock-Daten — im Kern das, was der Prototyp schon ist, nur
> „production-ified". Das ist in Ordnung, **wenn** es die Absicht ist: erst die Shell,
> dann verdrahten. Aber „production React UI" und „funktionierende IDE" trennt das
> gesamte Backend. Dieser Pass baut die **Shell**, nicht das Produkt.

**Auftrag schärfen:** Es existiert ein JSX-Prototyp *und* eine `_shadcn/`-Produktionsebene.
Der ehrlichere, billigere Auftrag ist **„Prototyp härten" statt „Greenfield-Neubau"** —
also die Komposition des Prototyps auf die `_shadcn/`-Primitive heben, nicht von null
nachbauen. Neubau wirft Arbeit weg, die schon produktionsnah ist.

---

## 1. Komponenten-Ebenen klarstellen (sonst Dubletten)

Es gibt zwei Komponenten-Ebenen im Design-System. Claude Code muss wissen, welche
kanonisch ist, sonst erfindet es eine dritte:

- **`_shadcn/` = Quelle der Wahrheit für Produktion.** Radix + Tailwind + cva, auf die
  Capisco-JetBrains-Dark-Palette gethemt (`app/globals.css`, `.dark` kanonisch). Enthält
  `components/ui/*` und `components/capisco/*`. **Hierauf wird gebaut.**
- **`components/` (in-browser) = Mock-Spiegel.** Nur für das in-browser-UI-Kit. Nicht die
  Produktionsquelle. Nicht erweitern, nicht duplizieren.

Regel: Primitive **komponieren**, nicht in Screens neu implementieren.

---

## 2. Phasenschnitt — nicht als Monolith bauen

Die Spec beschreibt *alle* Views, als wären sie gleichzeitig zu bauen (Agents, Git-Dashboard
mit 7 Tabs, Tasks mit Board + Insights + zwei Burndowns, Services, Data, PR-Boards, Editor
mit Live-Presence). Selbst als reiner UI-Bau ist das eine riesige flache Fläche — „alles auf
einmal" liefert überall 80 % statt an den wichtigen Stellen 100 %.

Bauen in **wert-zuerst-Reihenfolge** (spiegelt Konzept §8). Jeder Pass ein eigener,
fokussierter Auftrag:

- **Pass 1 — Fundament + Differenzierer.** Window-Chrome (Titelleiste, zwei Activity-Bars
  inkl. Drag/Drop-Dock, Statusleiste), Editor-Modus, **Agents-Modus** (Session-Tabs,
  Chat-Spalte, ToolAction, Broker-Prompt, Composer). Das ist das Alleinstellungsmerkmal —
  hier 100 % Politur.
- **Pass 2 — Git-Nähe.** Changes / Commit (Work Stash) / Diff-View. Editor + Git ist ein
  brauchbares Tool.
- **Pass 3 — Dashboards & Boards.** Git-Dashboard (Tabs schrittweise), Tasks-Workspace,
  PR-Board.
- **Pass 4 — Tooling-Breite.** Services (ctop), Data (Datasource, prod read-only),
  Search, Structure, Alerts/Inspect-Flyouts.

Ein gehärteter Agents-Modus ist mehr wert als sieben halbfertige Dashboards.

---

## 3. Korrekturen — gegen das Konzept abgleichen

Zwei konkrete Widersprüche, die vor dem Bau aufzulösen sind:

- **Overdue-Schwelle.** Build-Spec §5 sagt „länger als **3 Tage**", fest. Konzept §4.6 (und
  frühere Festlegung) sagt **7 Tage als Default, einstellbar**. → Korrekt ist **7 Tage,
  konfigurierbar**. Die „3" in der Spec ist zu ändern, und die Einstellbarkeit zu ergänzen.
- **Chat-Lesespalte.** Build-Spec §4 sagt „centered in a ~740px reading column". Der
  Prototyp-Screenshot zeigt sie aber **rechts der Mitte** mit leerem Raum links. →
  Maßgeblich ist die Spec: **zentriert**. Bei Konflikt zwischen Prosa-Spec und Prototyp
  hat die Spec Vorrang; Prototyp-Zustand korrigieren.

---

## 4. Produktionsschichten, die die Spec auslässt

Diese müssen ergänzt werden, sonst löst Claude Code sie nach Gutdünken oder gar nicht:

- **State-/Daten-Shape-Verträge.** Die UI gegen **Interfaces** bauen, die später auf echte
  Provider mappen — nicht gegen hartcodierte Mocks. Mindestens für Agents (Session, Message,
  ToolAction, PermissionRequest), Explorer/Changes (Project, FileNode, DiffStat), Git-Dashboard
  (PR, Metric) und Tasks (Ticket). Mock-Daten *implementieren* diese Interfaces, ersetzen sie
  nicht.
- **i18n ab Tag eins.** Die Spec hat überall hartcodierte englische Strings und erwähnt keine
  String-Ebene. Nachrüsten ist die Hölle (Konzept §5.9). Von Anfang an über eine i18n-Schicht
  (z. B. react-i18next), auch wenn zunächst nur eine Sprache aktiv ist.
- **Tastatur, Command-Palette, Fokus-Management.** Eine maus-only-IDE ist nicht glaubwürdig.
  Die Command-Palette ist die Eskalationsleiter aus dem Konzept (§5.6.6) — ausgeblendete
  Features bleiben darüber auffindbar. Tab-Order, Shortcuts, Fokusfallen für Popups/Flyouts.
- **Leer-/Lade-/Fehler-Zustände + Virtualisierung.** An den Nicht-Happy-Paths entscheidet
  sich „production": leere Sessions/Projekte/Suchen, Lade- und Fehlerzustände, und
  Virtualisierung für schwere Listen (Dateibäume, Suchergebnisse, lange Diffs, lange
  Chat-Transkripte).

---

## 5. Offene Asset-Substitutionen (im Design-System markiert)

Platzhalter, die fürs echte Produkt zu ersetzen sind:

- **Brand-Mark** — `assets/capisco-mark.svg` (Session-Tree-Glyph) ist Platzhalter.
- **Fonts** — Inter + JetBrains Mono laden im Prototyp vom Google-Fonts-CDN; in Produktion
  **selbst hosten** (`.woff2` in `assets/fonts/`).
- **Icons** — Lucide vom CDN; falls Capisco ein eigenes Icon-Set bekommt, in `assets/icons/`
  ablegen und dokumentieren.

---

## 6. Grundsätzliche Disziplin

- **„Im Mock gezeichnet" ≠ „gebaut".** Das Design zeigt inzwischen viele Provider-Flächen
  (PR-Board, Git-Dashboard, Datasource …). Das ist gut für die Vision — aber die wert-zuerst-
  Reihenfolge (Konzept §8) gilt unverändert. Das Mockup darf nicht verleiten, alles
  gleichzeitig bauen zu wollen.
- **Invarianten bleiben hart.** Prod-Datasources read-only für alle Principals; Secrets nie
  im LLM-Context. Diese sind keine Konfigurationsoptionen (Konzept §3.2/§3.3) — die UI muss
  sie als unverhandelbar darstellen, nicht als Toggle.
- **Konvergenz vor Sprawl.** Neue UI-Flächen docken an bestehende Provider/Primitive an. Kein
  neues Strukturkonzept ohne Not.

---

## 7. Reihenfolge in einem Satz

`_shadcn/` ist die Quelle → Prototyp härten, nicht neu bauen → Pass 1 (Chrome + Editor +
Agents) zuerst und vollständig → Daten-Verträge + i18n + Tastatur + Zustände von Anfang an →
dann Pass 2–4 als je eigener Auftrag → Korrekturen (Overdue 7d/konfigurierbar, Chat zentriert)
einarbeiten → Platzhalter-Assets ersetzen.
