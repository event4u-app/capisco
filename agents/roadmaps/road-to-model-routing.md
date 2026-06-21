---
status: ready
block: Token-Ökonomie
depends_on: [road-to-session-store-and-acp, road-to-quality-grounding, road-to-token-economy]
autonomy: "A (Herkunfts-Routing + Quality-getriebene Eskalation — deterministisch testbar) / C (reale Ersparnis = Kalibrierung am echten Lauf)"
council: "Linsen 2026-06-21 (Architektur · Autonomie · Security) — Familie F3 Token-Ökonomie; Befunde der Quelle decken sich, unten verankert"
---

# Road to Modell-Routing — automatischer Modell-Wechsel (klein wo möglich)

**Goal:** Einstellbar (on/off): Der Agent nutzt **das kleinste Modell, das reicht**, und spart so
weiter Tokens — bei **Roadmap-Abarbeitung, kleinen Subtasks, ToDo-Ausführung**. Opus→Sonnet/Haiku
automatisch, wo die Aufgabe es zulässt. Schwester von `road-to-token-economy` (Konzept §5.10.5
„Modell-Routing").

> Referenz: `agents/tmp/feature-model-switch.txt` (Zerlegung + Leitplanken).

> **Kern-These (Architektur):** **Route nach Aufgaben-*Herkunft*, nicht nach Aufgaben-*Inhalt*.**
> Ein Inhalts-Classifier ist unzuverlässig (man bräuchte fast das große Modell, um zu beurteilen,
> ob das große nötig ist) **und** nicht-deterministisch (gegen die Test-Posture). Der Session-Tree
> kennt die **Herkunft** ohnehin (Subagent-Typ, Roadmap-Schritt-Kategorie, ToDo vs. freie
> Konversation) — daran hängt das Routing: deterministisch, testbar, ehrlich.

> **Asymmetrie-Warnung (die Begründung der Sperrliste + Eskalation):** Eine kleine Aufgabe
> versehentlich an Opus = ein paar Cent verschwendet (harmlos). Eine **unterschätzte** große
> Aufgabe an Haiku = „fast richtig, aber nicht ganz" — **der Marktschmerz Nr. 1**, gegen den das
> Produkt antritt, und oft **ohne Fehlermeldung** (plausibler, subtil falscher Code). Ein
> Token-Spar-Feature, das die Grounding-These untergräbt, hätte am falschen Ende gespart.

> **Mechanik ist trivial** (schon da): Session-Tree hat pro Session ein Modell, ACP spricht
> mehrere Backends, Composer-Control-Bar hat den Model-Picker, ein Subagent kann ein anderes
> Backend als sein Parent haben. Das Feature wird **nicht** an der Verdrahtung schwer, sondern an
> der **Klassifizierung** — die hier durch Herkunft statt Vorhersage gelöst wird.

## Akzeptanz

- **Deterministisches Herkunfts-Routing-Test:** Quelle/Rolle einer Session (Subagent-Typ,
  Roadmap-Schritt-Kategorie, ToDo) → Modell-Mapping, **ohne** Inhalts-Classifier. Bei gleicher
  Herkunft gleiches Modell (reproduzierbar).
- **Eskalations-Test (B5 als Router-Feedback):** kleines Modell schreibt Fix → Quality-Runner
  (PHPStan/ESLint/Tests) rot → **automatische** Hochstufung auf größeres Modell **mit den Fehlern
  als Kontext**. Hartes, geerdetes Signal — kein vager Confidence-Score. Deterministisch (das
  Quality-Urteil ist es).
- **Sperrlisten-Negativ-Assert (Invariante, Pflicht):** Sessions auf Broker-Pfad, das KI-Review
  selbst, und alles als „untrusted egress" markierte werden **nie** heruntergestuft — **unabhängig
  vom on/off-Schalter**, strukturell (nicht per Default abschaltbar). Eine
  Berechtigungs-/Urteils-/Sicherheits-Entscheidung von einem schwächeren Modell = Sicherheits-
  Downgrade.
- **Transparenz + Override:** Modell-Badge pro Session-Tree-Knoten zeigt, welches Modell welche
  Aufgabe macht (das Token-Tracking hat die Badge ohnehin); Mensch kann **pro Session überstimmen**
  („nein, das hier mit Opus"). DOM-Assert Badge + Override-Flow.
- **Ehrlicher Realismus** (Akzeptanz benennt die Grenze, statt Vollständigkeit vorzutäuschen):
  Eskalation = die unterschätzten Fälle laufen **doppelt** (klein gescheitert, dann groß) → der
  kleine Versuch kommt **obendrauf**. Netto-Gewinn nur, wenn die Mehrheit der gerouteten Aufgaben
  wirklich mechanisch ist. Reale Ersparnis = Kalibrierung am echten Roadmap-Lauf (Klasse C),
  nicht aus dem Bauch.

## Decision-Gate (PO — Agent kann nicht allein entscheiden)

| Gate | Default-Vorschlag | Begründung |
|---|---|---|
| Feature default an/aus | **default AUS** (anders als Terse-Modus) | Greift non-deterministisch ins *Ergebnis* ein; erst an realen Roadmap-Läufen kalibrieren, bevor es still im Hintergrund Modelle tauscht. |
| Routing-Klassen-Liste | **nur mechanische Klassen** (Roadmap-Schritt, kleine Subtasks, ToDo) | Freie Konversation / Architektur-Arbeit: **gar nicht routen** — höchste Fehlklassifikations-Gefahr, kleinster mechanischer Anteil. |

## Phase 0 — on/off + Herkunfts-Routing (deterministisch)

- [ ] **on/off-Schalter** (Setting), **default aus**.
- [ ] **Routing nach Herkunft/Rolle**: Mapping `Session-Quelle → Modell-Stufe` (Subagent-Typ,
      Roadmap-Schritt-Kategorie, ToDo vs. freie Konversation) — **kein** Inhalts-Classifier.
      Der Session-Tree kennt die Herkunft, weil *der Orchestrator* den Knoten so gespawnt hat.
- [ ] Beschränkung auf **mechanische Klassen**; freie Konversation/Architektur wird nie geroutet.
- [ ] Deterministischer Test: gleiche Herkunft → gleiches Modell.

## Phase 1 — Klein-zuerst mit Quality-getriebener Eskalation

- [ ] Kleines Modell läuft zuerst; **deterministisches Signal** „hat nicht gereicht" =
      **Quality-Runner rot** (B5: PHPStan/ESLint/Tests).
- [ ] **Automatische Hochstufung** auf das größere Modell **mit den Fehlern als Kontext** (B5
      wird zum Router-Feedback — die Capisco-eigene Antwort auf Modell-Routing).
- [ ] Eskalations-Test (s. Akzeptanz); Doppel-Lauf-Kosten der unterschätzten Fälle sichtbar/
      transparent.

## Phase 2 — Sperrliste als Invariante

- [ ] **Nie heruntergestuft** (strukturell, nicht per Default): Broker-Pfad (Berechtigungs-
      entscheidung), KI-Review selbst (das *ist* das Urteil — eher das stärkere Modell), alles
      „untrusted egress".
- [ ] Sperrlisten-Negativ-Assert (Pflicht): unabhängig vom on/off-Schalter kein Downgrade dieser
      Flächen. Erweiterung der Sperrliste = Security-Entscheidung, **nie autonom**.

## Phase 3 — Transparenz + Per-Session-Override

- [ ] **Modell-Badge pro Knoten** im Session-Tree (welches Modell welche Aufgabe macht).
- [ ] **Per-Session-Override** durch den Menschen („das hier mit Opus"); unsichtbares Auto-Routing
      vermeiden — Magie, die danebenliegt, zerstört Vertrauen.
- [ ] DOM-Assert Badge + Override-Flow.
