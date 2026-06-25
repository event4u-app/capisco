---
status: ready
block: Actually Works / Runtime
depends_on: [road-to-actually-works]
autonomy: "A (Quality-Runner + LSP-Logik) / B (Container + DAP + Recovery, braucht Docker/xdebug) / C (Real-Abnahme = Matze)"
---

# Road to Real Runtime — mächtiges Coden (Container · Debug · Quality · LSP · Recovery)

*W-Serie, Roadmap 2 von 3. Geteilte Doktrin, Invarianten, Verifikation, Council-
Konvergenz: siehe [`00-actually-works-overview.md`](00-actually-works-overview.md).
Setzt [`road-to-actually-works`](road-to-actually-works.md) voraus (Supervisor,
Workspace-Objekt, Test-Spine, echter Agent). Akzeptanz = manuelle Real-Abnahme +
Conformance/Invarianten-Tests, NICHT „Test grün".*

**Goal:** Aus „eine IDE, die Du benutzt" wird „eine IDE, die *mächtig* codet":
jeder Workspace läuft im **echten Container**, Du **debuggst** mit Breakpoints
(auch im Container), echte **Quality-Tools** erden das KI-Review und das
Model-Routing, Advanced-LSP-Navigation steht, und die App **erholt sich** von
Abstürzen langlebiger Prozesse.

---

## Phasen-Reihenfolge

| # | Phase | Was es real macht | Braucht Dich |
|---|---|---|---|
| P0 | Container-Runtime | Devcontainer/Traefik/ctop, exec-in-container | Docker-Daemon |
| P1 | Debugging (DAP/xdebug) | Breakpoints/Step/Inspect, auch im Container | xdebug/DAP |
| P2 | Quality real (Grounding) | PHPStan/Rector/ECS → Diagnostics + Routing-Signal | Tools/Container |
| P3 | Advanced-LSP | Go-to-Def/Refs/Rename, Multi-Worktree | LSP-Server |
| P4 | Crash- & State-Recovery | Sidecar/Agent/Container-Tod → graceful recover | — |

**Graph:** P0 → P1 (braucht Container-Pfad-Mapping) ; P0 → P2 (Tools im Container) ;
P3 nach `actually-works`-P5 (baut auf der LSP-Basis-Anbindung) ; P4 quer (härtet den
P1-Supervisor aus `actually-works`).

---

## Phase 0 — Worktree-Runtime + Container (Docker · Devcontainer · Traefik · ctop)

**Goal:** Jeder Workspace = isolierter Worktree (da) **+ echter Container**. Ersetzt
`FakeRuntimeProvider` (erfundene `docker stats`-Frames) durch echtes Docker, über
den `actually-works`-P1-Supervisor (kein zweiter Prozess-Manager).

- [ ] **Echte Worktrees** am echten Repo verifizieren (anlegen/wechseln/zerstören).
- [ ] **Devcontainer pro Workspace** (`devcontainer`-CLI-Lifecycle up/down), Prozess
      über den Supervisor.
- [ ] **Kanonisches Mount-Mapping als First-Class-Datenstruktur (Council-Trap):**
      `workspaceFolder ↔ Container-Pfad` pro Worktree, abgeleitet aus der
      Devcontainer-Mount-Config — **wird von P1 (DAP) konsumiert**, nicht dort neu
      abgeleitet. Hängt am `actually-works`-P1-Workspace-Objekt.
- [ ] **Port-Allocator + Traefik-Config-Generator** (`projekt-a.localhost`-Routing).
- [ ] **Runtime-Provider real** (Docker; Podman/nativ als Implementierungen) —
      `FakeRuntimeProvider` → echter Adapter.
- [ ] **Container-Monitoring (ctop):** echte `docker stats`-Streams (CPU/RAM/Status),
      über das P1-Coalescing gedrosselt, gruppiert pro Projekt.
- [ ] **In Container-Console verbinden:** `exec -it` über die Terminal-/PTY-
      Abstraktion (`actually-works`-P6).
- [ ] **Secrets-by-reference in den Container (Council-Trap, security-sensitive):**
      wenn Execution `docker exec` ist, ist der Injektionspunkt das Container-env —
      Threat-Model + Test: Credential nie in Image/Layer/argv, nur zur Laufzeit.
- [ ] **Conformance-Test:** echte `docker stats` vs. die bisherigen Fake-Frames.

**Stolpersteine:** Docker-Daemon-Erreichbarkeit; Devcontainer-CLI-Verhalten;
Port-Kollisionen; Traefik-Config-Reload; **Container↔Host-Pfad-Mappings (kritisch
für P1)**; Cleanup verwaister Container (über den Supervisor-Reap).

**Akzeptanz (real):** Du startest einen Workspace, ein **echter Container** läuft,
Du siehst seine **echte** CPU/RAM-Last, öffnest eine Shell **im Container**,
erreichst die App unter `projekt-x.localhost`.

---

## Phase 1 — Debugging (DAP / xdebug)

**Goal:** Echtes Step-Debugging — Breakpoints, Step, Variablen — **auch im
Container**, mit korrektem Pfad-Mapping (der eigentliche Knackpunkt). Heute: kein
DAP-Contract, gar nichts.

- [ ] **DAP-Host im Sidecar** (über den `actually-works`-P1-Supervisor), generischer
      Debug-Adapter pro Sprach-Pack.
- [ ] **xdebug (DBGp) Bridge:** Container connectet auf den IDE-Listener;
      **per-Worktree-Listener-Ports**.
- [ ] **Pfad-Mappings Container↔Host** aus der **P0-Mount-Datenstruktur** (nicht neu
      abgeleitet); `xdebug.client_host` OS-abhängig (`host.docker.internal` vs.
      Gateway-IP).
- [ ] **Breakpoints / Step over-into-out / Call-Stack / Variablen-Inspektion / Watch**.
- [ ] **Tests im Debugger** (Pest/PHPUnit/Vitest/Jest) — DAP-Reuse.
- [ ] **JS-Debug** (Node) für den TS-Pfad.

**Stolpersteine:** DBGp-Protokoll-Details; Pfad-Mapping bei verschachtelten Mounts;
mehrere gleichzeitige Debug-Sessions (per-Worktree-Ports); Breakpoint-Sync bei
Datei-Änderung; xdebug-Config im Container (`start_with_request`).

**Akzeptanz (real):** Du setzt einen Breakpoint in einer PHP-Datei, lädst die Seite
im Container, **die Ausführung hält an**, Du siehst die echten Variablenwerte,
steppst durch.

---

## Phase 2 — Quality real (Grounding) + Model-Routing-Signal

**Goal:** PHPStan/Rector/ECS laufen **echt** im Workspace/Container (eslint/tsc/
vitest sind schon real); strukturierter Output → Diagnostics + Fixes; **KI-Review
auf echten Tool-Fakten geerdet**; und das **Model-Routing bekommt echte
Quality-Verdicts** statt Fake-RED/GREEN (`escalation.ts` faltet die echten Verdicts
bereits — jetzt mit echten Tools gespeist).

- [ ] **Quality-Provider real erweitern:** PHPStan (JSON), Rector (Dry-Run-Diff),
      ECS/PHP-CS-Fixer — strukturierter Output, im P0-Container ausgeführt.
- [ ] **Diagnostics + anwendbare Fixes** in der UI; Tool-Findings als Grundwahrheit.
- [ ] **KI-Review geerdet:** erst Tools laufen, deren Fakten dem Modell als Kontext
      geben (`FakeAiReviewProvider` → echter, key-gebundener Pfad).
- [ ] **Model-Routing-Eskalation real speisen:** `QualityGate` an
      `QualityProvider.runAll` mit echten PHPStan/ESLint-Ergebnissen; RED stuft hoch,
      Diagnostics als Kontext mitgeführt.
- [ ] **Doppellauf-Kosten sichtbar** (`EscalationOutcome.attempts`) am echten Lauf.

**Stolpersteine:** Tool-Installation pro Projekt/Container; Output-Format-Drift je
Tool-Version (Conformance-Test pro Tool); PHPStan-Performance auf großem Code;
Routing-Kalibrierung (Klasse-C, braucht echte Läufe).

**Akzeptanz (real):** Ein Agent-Lauf auf Haiku schreibt Code, **echtes PHPStan**
läuft, ist rot, das Routing **eskaliert automatisch** auf Sonnet/Opus mit den echten
Fehlern als Kontext, der zweite Lauf ist grün — Du siehst beide Versuche und die Kosten.

---

## Phase 3 — Advanced-LSP (Navigation jenseits Autocomplete)

**Goal:** Was über die `actually-works`-P5-LSP-Basis (Diagnostics/Hover/
Autocomplete) hinausgeht. Council-Hinweis: der *Agent* nutzt Deine LSP nicht —
diese Features dienen dem Menschen, darum hier statt in der Spine. **Harte
Voraussetzung: `actually-works` P5 ist abgenommen** (sonst hängt diese Phase in der
Luft).

- [ ] **Go-to-Definition, Find-References, Rename-Symbol** über den LSP-Host.
- [ ] **Inlay-Hints** (Parameter-Namen), **Blame-Line** inline (aus echtem Git).
- [ ] **Structure/Outline** (linke Bar) aus echten LSP-Symbolen.
- [ ] **Per-Worktree-LSP-Lifecycle (Council-Trap):** N Worktrees × M Sprachen =
      viele Prozesse; Crash-Restart / didOpen-didChange-Sync / Idle-Reaping — **über
      den `actually-works`-P1-Supervisor**, nicht neu gebaut.

**Stolpersteine:** LSP-Prozess-Lifecycle (Absturz/Restart); per-Worktree-Roots;
Init-Performance bei großen Projekten; PHP-LSP-Eigenheiten (Stubs/Indexing).

**Akzeptanz (real):** Cmd-Klick springt zur Definition über Dateien; Rename ändert
alle Referenzen; die Outline zeigt echte Symbole; mehrere Worktrees haben je eigene
LSP-Instanz ohne sich zu stören.

---

## Phase 4 — Crash- & State-Recovery

**Goal (Council-Lücke):** Der Unterschied zwischen „Demo" und „IDE, die den ganzen
Tag offen ist". Viele langlebige Subprozesse (Agent, PTY, LSP, Container, DAP) — kein
Phase besaß bisher „was, wenn einer stirbt".

- [ ] **Sidecar-Tod mid-run:** UI erkennt, reconnectet, stellt Session-Tree wieder her.
- [ ] **`claude` hängt / bricht ab:** Timeout + sauberer Abbruch + Wiederaufnahme
      (Retry-as-branch, Session-Tree).
- [ ] **Container gekillt:** Health-Erkennung → Neustart-Angebot, Ports/Mounts wieder her.
- [ ] **LSP/PTY-Crash:** Supervisor-Restart-mit-Backoff (aus `actually-works`-P1),
      UI zeigt „neu gestartet".
- [ ] **Adversarial-Test:** Prozesse absichtlich killen, assertieren, dass die App
      sauber erholt statt zu hängen/Daten zu verlieren.

**Stolpersteine:** Reconnect-Races; Session-State-Konsistenz nach Reconnect;
Backoff-Tuning (kein Restart-Sturm).

**Akzeptanz (real):** Du killst den Sidecar/Container/LSP von außen, die App merkt
es, zeigt es an und erholt sich — ohne Deine Arbeit zu verlieren.

---

## Akzeptanzkriterien (Roadmap-Exit)

- Manuelle Real-Abnahme jeder Phase erfüllt.
- Conformance-Tests grün (echte docker stats / PHPStan-Output / DAP vs. Fake-Shape).
- Invarianten halten unter Container-/Debug-/Quality-Pfaden (Secrets-by-ref in den
  Container getestet; Prod read-only; Audit vor Execution).
- Ein Agent-Lauf im Container, mit echtem Quality-Grounding, debuggbar, der einen
  Prozess-Crash übersteht.
