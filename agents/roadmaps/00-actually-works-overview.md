# Capisco — Track „Actually Works" (W-Serie) — Overview & geteilte Doktrin

*Stand: 2026-06-25. Track 3: „Funktioniert in Tests → funktioniert am Bildschirm."
Die UI-Shell (R-Serie) und der Backend-Backbone (B-/F-Serie) sind gegen **Fakes,
Stubs und Fixtures** gebaut und grün. Dieser Track verdrahtet den getesteten Motor
mit Rädern, Lenkrad, Zündschloss. Quelle: Bestandsaufnahme + Code-Verifikation
2026-06-25, AI-Council-Review (siehe unten).*

Dieser Index ist der Klebstoff für die drei W-Roadmaps. Er hält die **verifizierte
Realität**, die **geteilten Invarianten**, die **gekippte Verifikationsdoktrin**
und die **Council-Konvergenz** fest, damit die einzelnen Roadmaps schlank bleiben.

---

## 0. Framing (die Umkehr, ehrlich, einmal)

- **Diagnose.** Der Leitsatz „real wo autonom-verifizierbar, Fake wo es Dich
  braucht" hat einen exzellenten, getesteten Kern gebaut — und **fast nichts
  angeschlossen**. Alles, was der Mensch am Bildschirm als „funktioniert" erlebt,
  liegt per Definition in der „braucht Dich"-Hälfte. Die **deferred-Liste IST die
  Nutzer-Erwartungsliste.**
- **Umkehr.** Dieser Track ist *nicht* autonom-grün fahrbar. Er braucht echte
  Toolchains (Rust, Docker, eingeloggtes `claude`), Deine Maschine und **Dich, der
  den ersten echten Lauf abnimmt.**
- **„Done" heißt NICHT „Test grün".** Es heißt: Du öffnest es, tippst/klickst, und
  es tut, was eine IDE tut. Jede Phase endet mit manueller Real-Abnahme — gepaart
  mit automatisierten Conformance- und Invarianten-Tests (siehe §4).
- **Wert-zuerst, aber Risiko-bewusst.** Council-Korrektur: die dominante
  Risiko-Achse ist nicht „Nutzerwert", sondern **„langlebiger Subprozess unter dem
  echten Sidecar / Verifizierbarkeit"** — die quer durch alle Roadmaps schneidet.
  Darum das gemeinsame Fundament (Supervisor, Workspace-Modell, Transport, Test-
  Spine) **zuerst**, dann die gefühlte Scheibe, dann Breite.

---

## 1. Verifizierter Stand (gegen Code geprüft, 2026-06-25)

Korrigiert die Feedback-Diagnose an zwei Stellen — der Code ist weiter als gedacht.

| Bereich | Stand | Lücke zu „funktioniert" |
|---|---|---|
| **Editor** | **LIVE.** Editierbarer CodeMirror-Buffer, JS/TS-Highlighting, Rainbow-Brackets, Indent-Guides, Folding, **broker-gegatetes Save** | LSP (Autocomplete/Hover/Go-to-Def heute Mock-Overlays), PHP-Highlighting, externer File-Watch vs. Dirty-Buffer |
| **Agent-Backend** | **REAL hinter Env-Var** `CAPISCO_AGENT_BACKEND=native`: spawnt echtes `claude`-CLI, stream-json, **jeder Tool-Call broker-gegated** mit echtem Human-Prompt, echte Token-Telemetrie. `detect-exec` scannt den Host real | UI-Picker liest Mock-Katalog & steuert die Sidecar-Auswahl nicht; Composer-Bar zeigt Mock-„API" statt echtem Backend; Kosten (USD) nicht berechnet; **Scoped-Grant-UX für Massen-Läufe fehlt** |
| **Tauri-Shell** | **SCAFFOLD.** Cargo/`tauri.conf`, frameless, Ampel-Buttons im UI verdrahtet (`window-controls.ts`, `TitleBar.tsx`) | Rust leer: **kein Sidecar-Spawn, keine Tauri-IPC-Bridge** → Fenster öffnet mit Mocks; läuft heute als Browser-Tab über 127.0.0.1-WS-Dev-Bridge |
| **Quality** | eslint/tsc/vitest **real**; Model-Routing-Eskalation faltet bereits echte Quality-Verdicts | PHPStan/Rector/ECS fehlen; AI-Review ist Fake |
| **Terminal** | **PURE FAKE** — statischer Text, kein PTY, kein Contract | Alles: PTY-Prozess + Contract |
| **LSP** | **PURE FAKE** — kein Sprachserver | Basis (Diagnostics/Hover/Autocomplete) = `actually-works` P5; Advanced (Go-to-Def/Rename) = `real-runtime` P3 |
| **Container-Runtime** | **PURE FAKE** — `FakeRuntimeProvider`, erfundene `docker stats`-Frames; Interface sauber | Echter Docker/Devcontainer-Adapter |
| **Debugging (DAP/xdebug)** | **NICHT EXISTENT** — kein Contract | Alles |
| **Datasource/DB** | **PURE FAKE** — kein Treiber; Read-only-Invariante aus `env` abgeleitet (Struktur da) | Treiber + Schema-Introspektion |
| **OS-Keychain** | **PURE FAKE** — `InMemorySecretStore`, Secrets überleben keinen Neustart | Echter Keychain-Adapter (macOS `security`/DPAPI/libsecret) |

---

## 2. Die drei Roadmaps + Release (Council-reorder eingearbeitet)

| Roadmap | Block | Was es real macht | Status |
|---|---|---|---|
| [`road-to-actually-works`](road-to-actually-works.md) | **Spine → gefühlte IDE** | Fundament (Supervisor, Workspace-Modell, Test-Spine), echter Agent **im Browser bewiesen**, Editor fertig, Terminal, Tauri-Transport, Fenster, Minimal-Observability | ready |
| [`road-to-real-runtime`](road-to-real-runtime.md) | **Mächtiges Coden** | Container/Devcontainer/Traefik/ctop, Debugging (DAP/xdebug), Quality real, Advanced-LSP, Crash-Recovery | strukturiert |
| [`road-to-real-breadth`](road-to-real-breadth.md) | **Breite** | Tickets/Forge, Datasource, Keychain-Primitive (erster Konsument), Token-Ökonomie live, Observability-Provider, **gemanagter Browser (security-scoped)** | strukturiert |
| [`road-to-desktop-release`](road-to-desktop-release.md) | **Auslieferung** | Signierte Builds, Notarisierung, Auto-Update, CI-Matrix | ready (bestehend) |

**Abhängigkeitsgraph:**
`actually-works` (P0→P1→P2→P3→P4→**P5 LSP-Basis**→P6→P7→P8) → `real-runtime`
(Container→Debug→Quality→**Advanced-LSP**→Recovery) → `real-breadth`
(Tickets→Datasource→Token→Observability→Browser) → `desktop-release`.

> **Naht-Hinweis (Council-Gegenlesen):** Advanced-LSP (`real-runtime` P3) baut auf
> der **LSP-Basis** auf, die jetzt eine **eigene Phase** in `actually-works` (P5) mit
> eigenem Akzeptanzkriterium ist — nicht in „Editor fertig" versteckt. Ohne diese
> saubere Grenze hinge `real-runtime` P3 in der Luft (LSP ist heute „PURE FAKE").

**Council-getriebene Reorder** (gegen den ursprünglichen 13-Phasen-Draft):
1. **W1 split.** Transport-Spike (Sidecar-Spawn + WS→Tauri-IPC-Swap auf dem
   *bestehenden* JSON-RPC) ist load-bearing → früh. Fenster-Chrome ist cosmetic → floatbar.
2. **Agent-Scheibe vor Tauri.** Der gefühlte Übergang ist „echter Agent schreibt
   echte Datei in den Live-Editor via Broker-Prompt" — das wird **im Browser-
   Dev-Bridge zuerst bewiesen** (entkoppelt das Agent-UI-Risiko vom Tauri-Risiko).
3. **Fundament einmal.** Sidecar-Prozess-Supervisor (spawn/reap/crash-restart/
   idle-cap), **ein kanonisches Workspace/Worktree-Objekt**, IPC-Coalescing — von
   PTY/LSP/container-exec/DAP geteilt.
4. **Observability in die Spine** (Minimal: Audit-Viewer, Broker-Entscheidungs-
   Stream, echtes Token-Meter, Subprozess-Health) — macht manuelle Abnahme
   *vertrauenswürdig*.
5. **Keychain-Primitive zum ersten echten Konsumenten** (Tickets/DB-Tokens in
   `real-breadth`), nicht ans Ende. Der Agent-Pfad braucht es nicht — `claude`-CLI
   managt eigene Auth.
6. **Browser-Fläche isoliert** als eigene security-scoped Phase (schlimmster
   Lethal-Trifecta-Hotspot: untrusted Web × echte Credentials × Egress, agent-getrieben).

---

## 3. Unverhandelbare Invarianten (gelten in JEDER W-Phase — Real-Werden lockert NIE)

```
„REAL ANSCHLIESSEN" HEISST NIE „GATE LOCKERN".
```

1. **Broker bleibt un-umgehbarer Chokepoint.** Jeder echte Tool-Call/Egress/Write
   läuft durch `authorize → (Human-Gate) → execute`. Kein Bypass beim Real-Werden.
2. **Secrets nie im LLM-Context** — auch nicht beim echten CLI/API/Container-Pfad.
   Credential nie ins Subprozess-env/argv; nur Execution-Layer-Injektion
   (HTTP/Browser/DB-Driver/Container-env). Capability-by-reference.
3. **Prod-Datasources read-only = Invariante**, strukturell unkonstruierbar
   schreibbar; nur per-Befehl-Einmal-Escape, danach automatisch wieder read-only.
4. **Lethal-Trifecta-Gate** bei Egress aus untrusted Output (Agent/Ticket/Web/
   Subagent) — hart, nie auto-gefeuert.
5. **Append-only Audit** vor jeder echten Ausführung (Akteur + Capability +
   credentialRef, nie Wert).
6. **Caveman/RTK/Compression** fassen nie Fakten/Safety-Flächen an (Diagnostics,
   Broker-Prompts, Audit) — Negativ-Asserts bleiben Pflicht.

Jede dieser sechs Invarianten bekommt **automatisierte Angriffstests** (§4.4) —
die manuelle Abnahme kann eine Security-Spine über 11 Phasen nicht verteidigen.

---

## 4. Verifikationsdoktrin (gekippt — Council-geschärft)

Manuelle Real-Abnahme ist die **richtige neue Ergänzung**, aber als *primäres*
Gate gefährlich (skaliert nicht, nicht CI-bar, zerfällt sobald die Maschine
abweicht). Darum: manuelle Abnahme als **Phase-Exit-Gate** + fünf automatisierte
Stützen.

1. **Conformance-Tests statt Fakes löschen.** Pro Fake **ein** Test, der die
   **echte** Implementierung fährt und assertet, dass der Fake noch dessen Shape
   trifft (echtes `claude`-stream-json vs. Fake; echte `docker stats` vs. erfundene
   Frames). Diese eine Regel hätte „macht nichts am Bildschirm" gefangen und fängt
   stream-json-Drift. **Kein neuer Fake ohne gepaarten Conformance-Test** (Review-/
   Lint-Regel).
2. **Der manuelle Lauf erzeugt die Fixture.** Jede Phase-Abnahme wird einmal
   aufgezeichnet (echte Session → Replay-Fixture) — der manuelle Check von heute
   wird der automatisierte Smoke von morgen. Re-Capture beim W0-Pin-Bump.
3. **Zwei CI-Lanes.** Fast-Lane (Fakes + Conformance-Shapes) auf jedem PR; nightly
   Real-Dependency-Lane (echtes claude/docker/PTY) fängt Drift binnen eines Tages
   ohne PR-Velocity zu drosseln.
4. **Adversariale Invarianten-Tests — automatisiert, nie manuell.** Die sechs
   Invarianten (§3) bekommen dedizierte Tests, die sie zu *verletzen versuchen* und
   assertieren, dass das Gate hält. Wichtigste Einzel-Investition — „real anschließen"
   ist genau der Moment, in dem sie am meisten gefährdet sind.
5. **Acceptance-as-Runbook.** Auch manuelle Schritte werden niedergeschrieben, so
   dass jeder Reviewer denselben Check reproduziert. Manuell ≠ undokumentiert.

> Manuelle Abnahme beantwortet „funktioniert es *jetzt auf meiner Maschine*";
> Conformance + Adversarial-Invarianten beantworten „ist es *noch* wahr nach der
> nächsten Phase". Du brauchst beides; die Security-Invarianten leben komplett in
> der automatisierten Spalte.

---

## 5. Geteilte Fundament-Primitive (einmal gebaut, von vielen Phasen konsumiert)

Council-Befund #3/#4 — sonst wird dasselbe viermal gebaut bzw. fällt durch.

- **Sidecar-Prozess-Supervisor.** spawn / reap / crash-restart-mit-backoff /
  idle-timeout / Ressourcen-Cap. Konsumiert von **PTY** (Terminal), **LSP**,
  **container-exec**, **DAP**. Höchster Hebel. → `actually-works` P1.
- **Ein kanonisches Workspace/Worktree-Objekt.** Worktree, Container, LSP-Root,
  DAP-Root tragen sonst je eigene Pfad-Identität → Drift. Einmal definieren, früh.
  → `actually-works` P1.
- **IPC-Coalescing-Layer.** Hochfrequente Streams (PTY-Bytes, Token-Bursts,
  Container-Stats) nie 1:1 auf Tauri-IPC mappen — cap ~60fps, drop-oldest für
  Stats. WS bekommt TCP-Backpressure gratis, Tauri-Events nicht. → `actually-works` P1/P5.
- **Config-Persistenz-Store.** Nicht nur Fensterzustand — auch gewähltes Backend,
  Container-Image, Datasource-Connections. → `actually-works` P6.
- **Crash- & State-Recovery.** Sidecar stirbt mid-run / `claude` hängt / Container
  gekillt → graceful recover. Der Unterschied zwischen „Demo" und „IDE, die den
  ganzen Tag offen ist". → `real-runtime` (eigene Phase).

---

## 6. Human-gated — NIE autonom (Build hält an)

- **Erster echter Agent-Lauf** (`actually-works` P2) — **Du nimmst ihn ab.**
- Welche Datasource `production` ist (`real-breadth`) — human-confirmed, nie aus
  Connection-String inferiert.
- Default-Grant-Allowlist/-Scopes (konservativ, human-authored).
- RTK-Binary-Install; Presence/Sync aktivieren; Tenant-Fan-out-Write;
  Cross-Projekt-Egress an Cloud-Modell.
- **Agent-Browser-Login + jede Egress aus untrusted Web** (`real-breadth` Browser-Phase).
- Signing/Notarisierung/Release-Tag (`desktop-release`).

### 6a. Design-Gates (Klasse-S) — erzwungenes Tor, kein Default-Weiterbau

Ein **Design-Gate (Klasse-S / Security)** ist ein Pre-Phase-Tor, das das Fortfahren
*strukturell* blockiert (anders als ein Decision-Gate mit Default):

- **Erster Schritt der Phase ist das Gate selbst.** Kein Code-Schritt darf abgehakt
  werden, solange das Gate offen ist — der Agent **hält an und fordert es an**, baut
  nicht „schon mal das Drumherum".
- **Öffnet nur durch ein menschlich freigegebenes, geschriebenes Design-Dokument**,
  das einen **zweiten unabhängigen Durchgang** (Multi-Modell-Council ODER zweiter
  Matze-Durchgang) bestanden hat — Single-Reviewer reicht für diese zwei
  Entscheidungen nachweislich nicht (§7).
- **Build-Stopp ist wörtlich:** korrekter Agent-Zustand = „blockiert, wartet auf
  Matze", nicht „autonom weiter mit konservativem Default".
- **Ergänzt** die adversarialen Invarianten-Tests (§4.4), ersetzt sie nicht: Gate
  erzwingt das *Design* vor Code, die Tests erzwingen, dass das Design *hält*. Das
  Gate-Artefakt wird **Acceptance-as-Runbook** (§4.5) — versioniert, nicht mündlich.

> Faustregel: Decision-Gate = „Default gesetzt, ich baue weiter, Override jederzeit."
> Design-Gate = „**Ich baue NICHT, bis das zweit-reviewte Design vorliegt.**"

Zwei Design-Gates sind aktiv (heben die zwei „offenen Kanten" aus §7 von Empfehlung
auf erzwungenes Tor):

- **G-BROWSER — Browser-Threat-Model (`real-breadth` P4).** *Build hält an vor jeder
  Zeile Browser-Code.* Zweit-reviewtes Threat-Model (Abuse-Cases + Gate-pro-Aktion-
  Matrix) Pflicht. Schlimmster Lethal-Trifecta-Hotspot (untrusted Web × echte
  Credentials × agent-getriebener Egress).
- **G-PROD-RO — Prod-read-only-Durchsetzung am Treiber-Layer (`real-breadth` P1).**
  *Build hält an vor der Schreib-Durchsetzung* (lesender Betrieb läuft frei).
  Zweit-reviewtes Enforcement-Design Pflicht — read-only **strukturell am
  Treiber-Layer**, nicht nur UI; inkl. adversarialem Testdesign.

---

## 7. Externes Review (eingearbeitet) — ehrlich über das Gewicht

**Ein Reviewer, kein Council.** Der Lauf war als 3-Modell-Council geplant
(anthropic/openai/gemini), aber **nur claude-sonnet-4-5 lieferte** (CLI-Modus,
2026-06-25; Codex-Auth abgelaufen, Gemini-Setup-Fehler). Das ist ein **Single-
Reviewer**, keine Konvergenz mehrerer unabhängiger Perspektiven — dem Wort
„Konvergenz" wird hier bewusst **nicht** mehr Autorität zugeschrieben, als ein
Einzel-Review verdient. Die fünf Korrekturen tragen, weil sie **gegen den echten
Code gegengeprüft** wurden, nicht weil mehrere Modelle nickten.

Eingearbeitete Korrekturen (alle code-verifiziert): (1) W1 „Desktop-App" ≠ „IDE",
split + Agent-Scheibe vor Tauri; (2) Broker-Hot-Path bei Massen-Läufen → scoped
grants vor dem ersten Bulk-Run; (3) ein Subprozess-Supervisor statt vier; (4)
adversariale Invarianten-Tests als Pflicht-Owner; (5) Observability in die Spine.
Plus: LSP-**Basis** als eigene Phase (Diagnostics/Hover zuerst, Autocomplete als
Nutzer-Wunsch); Keychain-Primitive zum ersten echten Konsumenten; Browser-Fläche
isoliert; W0 als ausführbarer `doctor`. Verifikationsdoktrin §4 ist die 5-Punkt-Fassung.

### Offene Kanten — wo die Realität noch nicht berührt wurde

Keine Konstruktionsfehler, aber die Stellen mit dem höchsten Überraschungs-Risiko:

- **Rust↔Sidecar↔WebView ist der größte ungetestete Integrationssprung** (`actually-
  works` P7). Er ist klugerweise hinter die im-Browser-bewiesene Agent-Scheibe
  geschoben — aber es ist der **einzige** nicht-autonom-verifizierbare Kern, an dem
  die „echtes Fenster"-Erfahrung hängt. Erwarte hier die meisten Überraschungen,
  nicht im Editor/Agent. Erster Real-Lauf ist explizit Klasse-C.
- **Datasource (`real-breadth` P1) ist der unterschätzte Brocken** — DataGrip-
  Funktionalität ist ein eigenes Produkt. Steht als *eine* Phase, wird realistisch
  beim Eintauchen in Unterphasen zerfallen; „**einbinden statt nachbauen**" ist dort
  die **zentrale** Architekturentscheidung, kein Nebensatz.
- **Zweiter echter Blick vor Code** bei den zwei folgenschwersten Sicherheits-
  entscheidungen — **Browser-Threat-Model** (`real-breadth` P4) und **Prod-read-only-
  Durchsetzung am Treiber-Layer** (`real-breadth` P1). Ein Single-Reviewer reicht für
  diese zwei nicht. **Jetzt als erzwungenes Design-Gate (Klasse-S, §6a) verankert** —
  nicht mehr nur Empfehlung: der Build hält strukturell an, bis das zweit-reviewte
  Design-Dokument vorliegt (`G-BROWSER`, `G-PROD-RO`).
