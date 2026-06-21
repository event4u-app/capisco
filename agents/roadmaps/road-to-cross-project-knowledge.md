---
status: complete
block: Cross-Projekt
depends_on: [road-to-tauri-sidecar, road-to-session-store-and-acp, road-to-capability-broker]
autonomy: "A (P1 @-Verweis gegen Registry) / C+human-gated (P2 Session-Brücke — Broker-Scope + Secret-Leak-Gate)"
council: "3 Linsen 2026-06-21 (Architektur · Autonomie · Security) — Befunde unten verankert"
---

# Road to Cross-Projekt-Wissen — Verweis + Session-Brücke

**Goal:** „Wie Claude-Sessions voneinander wissen" — eine Capisco-Instanz weiß, dass es die
anderen (zuletzt geöffneten) Projekte gibt und wo sie liegen, kann auf sie **verweisen**, und —
als bewusste, schmale, **broker-gegatete** zweite Stufe — **Wissen aus einer Agent-Session in
Projekt A im Kontext von Projekt B nutzen** (z. B. Frontend-Wissen aus A für Backend-Arbeit in B).

> Referenz: `agents/tmp/feature-ide-linking.txt` (drei Runden Auflösung), DECISIONS B0
> (Recent-Projects-Registry **fertig**) + B3 (Cross-Projekt-Session-Suche **deferred**, Z. 171).

> **Council-Befund (Architektur · Security — höchstes Risiko des Bündels):** Zwei verschiedene
> Kostenklassen, durch eine **harte Decision-Gate-Grenze** getrennt — **P1 ist trivial + autonom**
> (Registry existiert), **P2 ist die teure, nicht-autonome Hälfte** (Broker-Scope-Erweiterung +
> Secret-Leak-Gate). Voraussetzung-Lücke: der Session-Store ist heute **pro-Store/in-memory** —
> Cross-Projekt-Read braucht einen **persistenten, projekt-übergreifend lesbaren** Store.
> **Library-attach / Symbol-Autocomplete ist vom Nutzer explizit auf später verschoben** (nicht
> in dieser Roadmap).

## Akzeptanz

### P1 (autonom, Klasse A)
- `@projekt`-Autocomplete gegen die Recent-Projects-Registry (B0, deterministischer
  Ordinal-`lastSeen`); klickbarer Verweis öffnet den vorhandenen Pfad. DOM-/Routing-Test bei
  Seed-Registry. **Veraltete Pfade**: leises „existiert nicht mehr" statt totem Verweis.

### P2 (human-gated — harte Security-Akzeptanz, architektonisch)
- **AK-C1 — Tresor-Disziplin auf den Brücken-Pfad:** Der Extraktions-Schritt A→B passiert eine
  Redaction/Inject-Stufe, die value-shaped Secrets (`:`/`=`/`password`/`token`-Form) **refuses**,
  nicht durchlässt (gleiches Muster wie Audit/Datasource-`credentialRef`).
- **AK-C2 — kuratierte Auszüge, nie Volltext:** B erhält nur `SessionSearchHit`-Auszüge /
  Zusammenfassungen, **keinen** Volltext-Getter über die Projektgrenze (ein 40-Nachrichten-Verlauf
  würde B's Kontext zumüllen *und* ist der Leak-Vektor).
- **AK-C3 — Egress-Gate vor Cloud:** A-Kontext → B's Prompt (evtl. Cloud-Modell) ist ein
  **`external`/`network`-Egress aus `fromUntrusted`-Quelle** → **harter Human-Gate**, von
  `session`/`scoped`-Grant **nicht** vorab freigebbar (Broker §3 MUST-NOT 4 / Lethal-Trifecta).
- **AK-C4 — eigene gescopte Capability:** `cross-project-read` ist eine **neue Scope-Achse**,
  kein impliziter Allow; PolicyEngine fail-closed (ohne explizite Regel → `ask`); **nicht** in
  der Default-Allowlist.
- **AK-C5 — menschgesteuerte Relevanz:** anfangs explizit-manuell („zieh aus *dieser* A-Session"
  / „aus Projekt A zum Thema X") — keine Auto-Relevanz, kein automatisches Cross-Projekt-Fan-out.
- **AK-C6 — Wissen ≠ Zugriff (harte Invariante):** Die Brücke trägt **nur Gesprächs-/
  Wissens-Kontext**, **nie** ausführbaren Cross-Projekt-Zugriff. Kein Codepfad erlaubt B's Agent,
  aus einem A-Auszug eine Operation auf A's Dateien/Containern auszulösen.
- **Cross-Projekt-Auszug-secret-frei-Assert** (Pflicht): geteilter Auszug ist nachweislich
  secret-frei (Negativ-Assert über die Projektgrenze). Search über Seed-Sessions zweier
  Mock-Projekte; Hit-Set deterministisch (monotoner `seq`, kein `Date.now`).

### Lethal-Trifecta (Security-Linse)
P2 ist die **einzige Voll-Trifecta** des Bündels (private-data A-Kontext × untrusted A-Output ×
Cloud-Egress). **Zwei Beine brechen**, bewusst redundant: **Egress-Gate** (AK-C3) + **Quarantäne**
(Redaction AK-C1 + kuratierte Auszüge AK-C2 → untrusted Volltext erreicht den Egress nie).

## Phase 1 — UI-Verweis (autonom, Wert sofort, Gate-frei)

- [x] **`@projekt`-Autocomplete** in Markdown-/Notiz-/ToDo-Kontext über die Registry
      (Projektnamen, nicht Methoden); Verweis kennt den Pfad.
- [x] **Klickbarer Verweis:** öffnet das Projekt (neues Fenster / zweite Root) bzw. springt
      dorthin — ruft den vorhandenen „Projekt öffnen"-Pfad auf.
- [x] Veraltete-Pfade leise behandeln; DOM-/Routing-Test bei Seed-Registry.

## Phase 2 — Cross-Projekt-Session-Brücke (Decision-Gate davor)

> **Decision-Gate (human / PO, DECISIONS:171 — „braucht Dich"):** Diese Phase überquert die
> Invariante „Secret nie im LLM-Context". Erst starten, wenn der Broker-Scope (`cross-project-read`)
> + die Redaction-Stufe + das Egress-Gate stehen. Default konservativ: nur menschgesteuerter,
> kuratierter Auszug, nie automatisch.

- [x] **Voraussetzung:** persistenter, projekt-übergreifend lesbarer Session-Store (heute
      in-memory/pro-Store) — oder Föderation über Projekt-Stores.
- [x] **Broker-Scope-Erweiterung:** neue gescopte Capability `cross-project-read` (AK-C4),
      fail-closed, nicht in Default-Allowlist.
- [x] **Redaction/Inject-Stufe** A→B (AK-C1) + **kuratierte Auszüge** statt Volltext (AK-C2);
      secret-frei-Assert (Pflicht).
- [x] **Egress-Gate** vor Cloud-Prompt (AK-C3, harter Human-Gate); menschgesteuerte
      Relevanz (AK-C5); **Wissen ≠ Zugriff**-Invariante (AK-C6).

## Out of scope (bewusst, Flag — nicht bauen)

- **Cross-Projekt-*Zugriff*** (ausführend, über Wissen hinaus: Dateien/Container in A) — eigene,
  spätere broker-gescopte Capability.
- **Library-attach / Cross-Projekt-Symbol-Autocomplete** (Methoden/Typen aus B in A) — vom Nutzer
  auf eine spätere Phase verschoben; kein Daemon, keine Live-Inter-Instanz-Kommunikation.
