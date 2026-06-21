---
status: complete
block: Breite
depends_on: [road-to-dashboards-boards]
unlocks: []
---

# Road to Tooling-Breadth (R6)

**Goal:** Die restlichen Tool-Flächen — Services (ctop), Data (Datasource mit Prod-Read-only-
Invariante), Alerts/Inspect-Flyouts — und die **geteilte Signal-Fläche** als einigende
Benachrichtigungsschiene (§5.2), die der Prototyp nur als getrennte Flyouts zeigt.

> Referenz: `build-spec.md` §3 (Data/Services) + §2 (Flyouts) + `ui_kits/.../views.jsx`/`shared.jsx`.

## Akzeptanz

- DOM-Assert; `verify:visual` gegen Goldens; Tastatur/Leer-Lade-Fehler/i18n/axe.
- **Invariante hart sichtbar (Overview §2.2):** Prod-Datasource `READ-ONLY`-Badge + Lock-Glyphen,
  **kein** Schreib-Toggle, kein „dauerhaft". Secret nie als Wert.

## Phase 0 — Services (ctop)

- [x] Container-Liste **gruppiert nach geladenem Projekt** (sticky dunkle Header, `N/M up`-Count);
      pro Zeile: Status-Dot, Name, Image, CPU-Bar, Mem, Ports, `exec -it`-Console-Action.
      Speist sich aus `Container`/`ServiceStat` (Mock).

## Phase 1 — Data (Datasource, Prod read-only)

- [x] Datasource-Explorer gruppiert nach Connection; `prod` zeigt **READ-ONLY**-Badge + Lock auf
      Tabellen (Broker-Invariante als UI-Faktum, nicht Toggle). Aus `Datasource`/`Table`
      (`readonly`-Flag) (Mock).

## Phase 2 — Signal-Fläche & Flyouts

- [x] **Alerts/Inspect** als Flyout: unpinned overlay (schließt bei Klick in Workspace), **pinned
      dockt als Spalte, Center schrumpft**. Severity-Dots (waiting/success/warning/idle).
- [x] **Geteilte Signal-Fläche (§5.2):** *eine* Benachrichtigungsschiene speist Alerts (PR/
      Container/Observability als gleiche `SignalItem`-Form). Regel-Seite bewusst dumm (2–3 Regeln).

## Council-Notizen

- Signal-Fläche war im Prototyp nur als separate Flyouts da — Konzept-Fläche §5.2 hier verankern (Reviewer 1).
- Prod-read-only ist Invariante, kein Feature-Toggle — UI muss es als unverhandelbar zeigen.
