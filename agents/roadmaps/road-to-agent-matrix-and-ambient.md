---
status: ready
block: Ambient / Agent-Awareness
depends_on: ["road-to-actually-works.md", "road-to-real-runtime.md"]
autonomy: "A (Matrix-Panel, Scheduler, Digest-Composer, Lernschleifen-Auswertung — autonom baubar auf existierenden Streams) / B (Scoped-Grant-UX braucht Matzes Security-Design-Review; Nachtlauf-Realabnahme braucht Matzes Maschine; Voice braucht lokale STT/TTS-Toolchain)"
---

# Road to Agent-Matrix & Ambient — das Hirn und die Nachtschicht

*Diese Roadmap setzt die zwei genuin neuen Stücke aus der Jarvis-Analyse
(`agents/tmp/jarvis.txt`, §5.11) plus Matzes Matrix-Wunsch um: (1) eine
**Agent-Matrix** — die Live-Visualisierung, wie alle Agents, Subagents,
Prozesse und Broker-Entscheidungen gerade arbeiten („das Hirn") — und
(2) die drei schmalen Ambient-Modalitäten (Hintergrund-Läufe + Digest,
Trace-Lernschleife, Voice-I/O). Alles andere aus dem Jarvis-Genre bleibt
bewusst draußen (siehe Scope-Grenze). Akzeptanz = manuelle Real-Abnahme +
Unit/Visual-Goldens, NICHT „Test grün".*

*Council (claude-sonnet-4-5 + gpt-4o, 2026-07-05, 2 Runden Debatte auf dem
Entwurf): Konvergenz auf (a) Matrix ist unabhängig vom Scoped-Grant und
zieht als erste Phase vor, (b) die Null-Kosten-Invariante braucht einen
Enforcement-Mechanismus statt eines Einmal-Beweises, (c) Headless-Sessions
sind ein neuer Lifecycle (Design vor Bau), (d) Digest braucht Batch-Dedup,
(e) Scheduler braucht eine Concurrency-Policy, (f) Scrubbing/Privacy braucht
verifizierende Tests statt Behauptungen, (g) Rollback-Kriterien pro Phase.
Verworfen nach Host-Prüfung: User-Kommunikationsplan + produktweite
Telemetrie (internes Tool, ein Nutzer, lokal-first — Konzept §1/§4.9);
„Matzes Maschine als Risiko" (bewusste W-Serie-Doktrin: manuelle
Real-Abnahme IST das Akzeptanzmodell).*

**Goal:** Ein Blick auf die Matrix zeigt, welche Sessions/Subagents laufen,
was sie kosten, welche Prozesse leben und was der Broker zuletzt entschieden
hat — **abschaltbar und mit beweisbar null Kosten, wenn sie zu ist**. Und
zwar nicht nur für diese Instanz: Die Matrix ist **scope-bar** (dieses
Projekt · gezielte Projekte · alle Instanzen) — wer vier IDEs offen hat,
sieht in jeder davon wahlweise alles; jede Instanz ist eine universelle
Zentrale. Ein Klick auf einen fremden Agent fokussiert die passende IDE
mit dem laufenden Prozess/Chat. Nachts
arbeitet ein Agent unter einem konservativen Scoped-Grant eine Roadmap-Phase
ab und morgens liegt ein deduplizierter Digest in der Signal-Fläche. Die
Trace-Historie kalibriert das Model-Routing mit echten Zahlen statt
Bauchgefühl. Voice bleibt ein später, lokaler, opt-in Ein-/Ausgabekanal mit
eigenem Bleibt-oder-fliegt-Gate.

---

## Ist-Stand (geerdet, code-verifiziert 2026-07-05)

Die Matrix ist eine **Projektion**, kein neues Subsystem — die Datenströme
existieren bereits:

- **Session-Tree + Subagents**: `sidecar/session/in-memory-session-store.ts`
  (Sessions, Subagents, `branch()`); Frontend hat `SessionTabbar`,
  `SubagentRow`, `ContextBudgetMeter`. Achtung: Store ist **in-memory**,
  überlebt keinen Restart — relevant für P2 (Headless-Lifecycle).
- **Broker-Entscheidungs-Stream**: `broker/audit-store.ts` append-only,
  `InMemoryAuditStore.subscribe` (live authorize/gate/execute) — **done**
  in actually-works P3. Der Audit-Log-**Viewer** ist dort noch offen
  (Z. 155) → wird hier in P0 eingelöst.
- **Prozess-Gesundheit**: `supervisor/process-supervisor.ts` —
  `health()` + subscribe (PTY/LSP/Agent-Prozesse, Restarts) — done.
- **Container-Stats**: `runtime/docker-exec.ts` — gedrosselte, koaleszierte
  `docker stats`-Streams (real-runtime P0 done); ctop-UI-Slice noch offen
  → wird hier in P0 eingelöst.
- **Token-Telemetrie**: `telemetry/telemetry-store.ts` (file-backed, echte
  Tokens aus Agent-Läufen); der echte Token-/Kosten-Meter im UI ist in
  actually-works P3 noch offen (Z. 159) → hier in P0; USD-Rechnung gehört
  real-breadth P2 (nicht duplizieren).
- **Signal-Fläche**: `RealSignalProvider` + `SignalFlyout` (eine Schiene,
  Live-Dedup) — done in real-breadth P3. Batch-Dedup für Digests existiert
  NICHT (anderes Problem als Live-Dedup).
- **Crash/Recovery-Primitive für lange Läufe**: Sidecar-Death-Reconnect,
  Claude-Stall-Watchdog, Container-Kill-Recovery — real-runtime P4 done.
- **Scoped-Grant / Bulk-Run-UX (Council #2)**: die Grant-**Achse**
  (`once/session/scoped/deny`) existiert im Contract; die **UX und das
  Task-gebundene Scope-Primitiv** sind offen — der meistzitierte offene
  Punkt der W-Serie (actually-works P2, Z. 125). Hintergrund-Läufe sind
  dessen Konsument.
- **Model-Routing**: `model-routing/live-router.ts` + `escalation.ts` +
  `quality-gate.ts` real; Kalibrierung an echten Läufen (real-breadth P2)
  offen, Klasse-C.
- **Cross-Project-Bridge**: `sidecar/cross-project/` existiert real, inkl.
  Redaction (`redact-excerpt.ts`) — das natürliche Fundament für die
  Matrix-Federation (Phase 0b). Eine Instanz-Presence/Discovery über
  mehrere laufende Capisco-Prozesse existiert noch NICHT.

## Scope-Grenze (verbatim aus der Jarvis-Analyse — bleibt stehen)

Home-Automation; Chat-App-Frontends (WhatsApp/Telegram/Discord/iMessage);
Voll-Computer-Steuerung über den Dev-Workspace hinaus; 24/7-Lebens-Assistent.
Das ist ein anderes Produkt (Leben-OS statt Entwickler-IDE) und der ultimative
„tolle Demo, schwache Dringlichkeit"-Fall.

## Querschnitts-Invariante — die Matrix ist gratis, wenn sie zu ist

```
DIE MATRIX IST EINE PROJEKTION EXISTIERENDER STREAMS. KEIN NEUER DATENPFAD.
GESCHLOSSEN = NULL SUBSCRIPTIONS, NULL POLLING, NULL RENDER-KOSTEN.
SUBSCRIBE-ON-SHOW, UNSUBSCRIBE-ON-HIDE. EVENT-GETRIEBEN, KEIN FRAME-LOOP.
DIE INVARIANTE IST MECHANISMUS, NICHT PROSA: SUBSCRIPTION-ZÄHLER IM SIDECAR
+ CI-LECK-TEST WACHEN DAUERHAFT — NICHT EIN EINMALIGER BEWEIS.
SIE GILT AUCH FÖDERIERT: REMOTE-INSTANZEN WERDEN NUR ABONNIERT, WENN DIE
MATRIX OFFEN IST UND DER SCOPE SIE EINSCHLIESST — NIE IM HINTERGRUND.
WAS NICHT SCHON GESTREAMT WIRD, ZEIGT DIE MATRIX IN V1 NICHT.
```

## Querschnitts-Invariante — der Broker bleibt un-umgehbar, auch nachts

```
HINTERGRUND-AUTONOMIE IST EIN KONSUMENT DES SCOPED-GRANT-PRIMITIVS,
NIE EIN GRUND, DAS GATE ZU LOCKERN. EIN NACHTLAUF, DER AUF EIN
HUMAN-GATE TRIFFT, PAUSIERT SAUBER UND MELDET ES IM DIGEST —
ER UMGEHT NICHTS, ER ESKALIERT NICHTS, ER MERKT SICH KEINE FREIGABEN.
PROD-READ-ONLY UND SECRETS-NIE-IM-CONTEXT GELTEN UNVERÄNDERT.
```

---

## Phasen

> Reihenfolge-Logik (Council-Konvergenz, host-verifiziert): P0 (Matrix) ist
> eine reine Read-only-Projektion auf fertige Streams und hängt an NICHTS
> aus P1/P2 — sie liefert sofort täglichen Wert und ist das Fenster, durch
> das man den späteren Phasen bei der Arbeit zusieht. P0b (Federation) macht
> daraus die universelle Zentrale über alle Instanzen — nach P0, weil sie
> dessen Projektion nur föderiert, nichts Neues rendert. P1 (Scoped-Grant)
> ist das Sicherheits-Gate für P2. P3/P4 sind unabhängig und bewusst spät.

## Phase 0 — Agent-Matrix v1 (das „Hirn"; schließt zugleich offene Observability-UI-Schuld)

> Read-only. Konsumiert vier existierende Streams und ist damit zugleich der
> fehlende Audit-Viewer, Token-Meter und die Health-/ctop-Leiste
> (actually-works P3 · real-runtime ctop-Follow-up — dort abhaken, wenn
> hier gelandet). Kein Bezug zu Scoped-Grants — bewusst VOR P1 gezogen.

- [x] Matrix-Workspace/Panel-Skeleton: eigener Mode (neben
      `agents|chat|editor|git|tasks|diff`) ODER Rail-Panel — Entscheidung
      per Design-Sync (Entscheider: Matze; Default-Vorschlag: eigener Mode,
      weil die Fläche graph-förmig ist); Setting `matrix.enabled`
      (Default: an — vertretbar, weil geschlossen beweisbar gratis). <!-- done: eigener `matrix`-Mode nach dem `sentry`-Muster (WorkspaceMode-Union + ActivityBar `mode-matrix` mit Network-Icon + Shell-Switch + CommandPalette-Icon + i18n `mode.matrix`), `MatrixWorkspace` in `app/src/shell/matrix/`. DEFERRED: das `matrix.enabled`-Setting — die Null-Kosten-Garantie kommt bereits aus Mount/Unmount (Mode-Auswahl); das Setting ist ein reiner Convenience-Toggle, kein load-bearing Teil (Fast-Follow). -->
- [x] Graph-Ansicht: Sessions als Knoten (Status, Modell, Tokens live),
      Subagents als Kind-Knoten, Kanten = Eltern-Beziehung; Workspace-
      Zuordnung (Worktree) sichtbar; event-getriebenes Layout, kein
      Frame-Loop, koaleszierte Updates (bestehende Drossel-Primitive). <!-- done: selbst-enthaltenes SVG (kein Graph-Lib/CDN), reine `layoutGraph` (index-basiert: Sessions Spalte 0, Subagents Spalte 1, Kanten Eltern→Kind, NIE DOM-gemessen → golden-stabil), Node mit Status-Dot/Modell/Live-Tokens; Updates event-getrieben via `subscribe` pro Session (kein Frame-Loop). DEFERRED: RAF-Koaleszierung (Mock feuert endlich+deterministisch; nötig erst bei echtem High-Frequency-Stream) + sichtbare Worktree-Zuordnung (kommt mit dem echten Multi-Worktree-Stream). -->
- [x] Degradations-Strategie (Council-Neubefund): Knoten-Budget mit
      Fallback — Ziel <16 ms Layout bei 100 Knoten; über ~150 Knoten
      automatisch Listen-/Baum-Ansicht statt Graph; Stress-Test: 200
      Sessions in 1 s spawnen, UI bleibt bedienbar. <!-- done: >150 Knoten → `MatrixTreeFallback` (Liste/Baum) statt Graph, `nodeLimit`-Prop (Default 150) + `countNodes`-Gate; Layout O(n) (ein Pass, keine Physik/Iteration). DEFERRED: expliziter 200-Sessions-in-1s-Perf-Stress-Test (Perf-Bench, nicht golden-verifizierbar). -->
- [x] Broker-Ticker + Audit-Log-Viewer (löst actually-works P3 Z. 155 ein):
      Live-Zeile der letzten N Broker-Entscheidungen (actor · capability ·
      scope · Entscheidung); Klick → voller Audit-Trail als Liste
      (Filter: Session, Zeitraum, Entscheidungstyp); Test: Secret-Referenzen
      werden gerendert (`env.API_KEY`), nie Werte. <!-- done: `MockAuditStore` (`mocks/audit.ts`, append-only record/list/subscribe, deterministische Fixturen, Einträge `Object.freeze`) + `BrokerTicker` als Matrix-Footer — letzte N Entscheidungen (actor-Icon · capability · target · Outcome-Ampel allow/executed/ask/deny), „view all" klappt den vollen Append-Trail auf. SECRET-SAFE by construction: `AuditEntry` hat KEIN value-Feld, Secrets erscheinen nur als `credential: <ref>` (Name) — Unit- + Struktur-Test asserten den Namen + Abwesenheit von Secret-Mustern. Null-cost: subscribe-on-mount/unsubscribe-on-unmount (Leck-Test). DEFERRED: die Live-`AuditStore.subscribe`-Verdrahtung über die IPC-Wire (Klasse-B, real-runtime; `BrokerProvider` bietet heute nur `listAudit()`-Snapshot) + die Filter (Session/Zeitraum/Typ, Fast-Follow). Damit ist die UI-Schuld aus actually-works P3 Z.155 frontend-seitig eingelöst; die reale Datenanbindung bleibt dort offen. -->
- [ ] Prozess-/Container-Leiste: `ProcessSupervisor.health()` + Docker-Stats
      als kompakte Leiste (= ctop-UI-Slice), Restart-Ereignisse markiert. <!-- next PR: TEIL-GATED — Docker-Stats Klasse-A (`FakeRuntimeProvider.subscribeStats` existiert), aber `ProcessSupervisor.health()` sidecar-only (kein Frontend-Contract). Braucht zuerst `SupervisorProvider`-Contract+Mock; Docker-Slice kann separat. Bewusst nicht als Fake gerendert. -->
- [x] Token-Meter (löst actually-works P3 Z. 159 ein): echte Telemetrie pro
      Session/Subagent aggregiert, Schwellwert-Ampel grün→orange→rot;
      USD erst, wenn die Preis-Quelle existiert (real-breadth P2). <!-- done: pro Node `telemetry.tokensOut` (aus dem Session-Stream, deterministisch) mit Schwellwert-Ampel grün→orange→rot (`tokenTone`); USD bewusst weggelassen (real-breadth P2). -->
- [x] Null-Kosten-Enforcement (Mechanismus, nicht Einmal-Beweis):
      Subscription-Zähler im Sidecar assertbar; CI-Test „Matrix zu ⇒
      Zähler == 0 nach Idle"; Leck-Detektor schlägt bei jeder künftigen
      Subscription an, die ohne sichtbare Matrix lebt. <!-- done (Frontend-Leg, Klasse-A): subscribe-on-show/unsubscribe-on-hide via `useEffect`-Cleanup; ein `countingProvider`-Wrapper zählt aktive Subscriptions, der CI-Vitest-Leck-Test mountet die Matrix (peak>0) und asserted nach Unmount `active==0`. DEFERRED (Klasse-B, real-runtime): der sidecar-seitige IPC-Subscription-Zähler + CI-Idle-Leck-Test — braucht einen laufenden Sidecar in CI. Die zwei Ebenen werden getrennt getrackt (Council-Konvergenz). -->
- [x] Visual-Goldens + axe für den neuen Mode; Design 1:1 nach
      Design-System-Tokens (keine Tailwind-Nachbauten der Prototyp-Flächen). <!-- done: `matrix-dark/light` Goldens (darwin) + axe (keine serious/critical außer tracked contrast) + Struktur-Specs (`matrix.spec.ts`, laufen in CI). Kein Prototyp für die Matrix → greenfield direkt auf `--ds-*`-Tokens (`capisco-matrix.css`), kein Tailwind-Nachbau. Bestehende Goldens byte-identisch (neuer Mode nicht boot-sichtbar). -->
- [ ] Manuelle Real-Abnahme (Runbook `scripts/acceptance/` o. ä.,
      reproduzierbar): echter Agent-Lauf mit ≥2 Subagents sichtbar; Matrix
      schließen ⇒ Zähler-Beleg null. Rollback-Kriterium: hält die
      Null-Kosten-Invariante in der Praxis nicht → `matrix.enabled`
      Default auf aus, Panel bleibt opt-in. <!-- Klasse-C: braucht Matzes Maschine (echter Agent-Lauf + Live-Zähler-Beleg) — nicht autonom abschließbar. -->


## Phase 0b — Matrix-Federation (jede IDE eine universelle Zentrale)

> Wer vier Capisco-Instanzen offen hat, sieht in jeder davon wahlweise
> alles — oder gezielt gescoped. Lokal-first bleibt hart: Discovery und
> Streams laufen ausschließlich same-machine/same-user über Unix-Sockets
> (0600/0700), NIE über Netz; es gibt keinen Server. Baut auf dem realen
> `cross-project/`-Primitiv (inkl. Redaction) auf. Degradiert mit einer
> einzigen Instanz sauber auf Phase 0 — null Mehrkosten.

- [ ] Instanz-Presence-Primitiv: jeder Sidecar publiziert beim Start eine
      Presence (Instanz-ID, Projekt, Worktree, PID, Socket-Pfad) unter
      `~/.capisco/instances/` + lauscht auf einem lokalen Unix-Socket;
      Stale-Einträge werden per PID-/mtime-Check aufgeräumt (Crash einer
      Instanz hinterlässt keine Geister-Knoten).
- [ ] Federation-Stream (read-only): Session-Tree, Status, Token-Telemetrie
      und Prozess-Gesundheit fremder Instanzen über deren Presence-Socket
      abonnieren — durch die bestehende Cross-Project-Redaction; Secret-
      Referenzen und Audit-Details bleiben instanz-lokal (Detail-Ansicht
      = Klick-zu-Instanz, nicht Daten-Kopie).
- [ ] Scope-Toggles in der Matrix: „dieses Projekt" · „alle Instanzen" ·
      gezielte Auswahl pro Projekt/Instanz (persistiert pro IDE-Fenster);
      Scope-Wechsel = Subscriptions kommen und gehen live (Invariante:
      nicht im Scope ⇒ nicht abonniert — Zähler-beweisbar).
- [ ] Klick-zu-Instanz: Klick auf einen fremden Agent-Knoten → die passende
      IDE-Instanz wird über ihren Presence-Socket fokussiert (Tauri-Window
      nach vorn) und öffnet die laufende Session/den Chat (`focusSession`);
      Instanz inzwischen tot → ehrlicher Hinweis statt stiller No-op.
- [ ] Adversarial-Tests: Socket-/Verzeichnis-Permissions (nur eigene UID);
      kein einziger Netzpfad im Federation-Modul (localhost/Unix only);
      Presence-Spoofing durch fremde UID scheitert; Federation-Streams
      enthalten nie Secret-Werte (Redaction-Test mit injiziertem Secret).
- [ ] Null-Kosten-Beweis föderiert: Matrix zu ODER Scope „nur dieses
      Projekt" ⇒ null Remote-Subscriptions (Zähler auf BEIDEN Seiten:
      Konsument abonniert nichts, Publisher hat keine Consumer).
- [ ] Manuelle Real-Abnahme (Runbook): 3 Instanzen auf 3 Projekten offen,
      eine Matrix auf „alle" — alle Agents sichtbar; Klick auf fremden
      Agent fokussiert die richtige IDE mit dem richtigen Chat; Scope auf
      „dieses Projekt" zurück ⇒ Remote-Zähler null. Rollback-Kriterium:
      ist Presence/Focus über Instanzen nicht zuverlässig (Fenster-Fokus
      OS-seitig verweigert, Geister-Instanzen) → Federation bleibt
      read-only-Ansicht ohne Klick-zu-Instanz, Rest der Roadmap unberührt.

## Phase 1 — Scoped-Grant-Primitiv (Council #2 einlösen; Gate für P2)

> Löst den offenen actually-works-P2-Punkt (Z. 125) ein — dort abhaken,
> wenn hier gelandet. **B: Design-Review durch Matze vor den Bau-Schritten.**
> Fallback statt Kill: die Grant-Achse existiert bereits im Contract;
> schlimmster Fall ist „manuelle Grants pro Datei" (hässlich, kein Blocker).

- [ ] Design-Dokument Scoped-Grant-UX (gated: erst Review, dann Bau):
      Grant-Shape (`writes unter src/ für diesen Task`), Anzeige, Widerruf,
      Ablauf (Task-Ende = Grant-Ende), Interaktion mit der bestehenden
      Grant-Achse (`once/session/scoped/deny`) — konservativ, human-authored
      Allowlist, kein Wildcard-Default.
- [ ] Broker: `scoped`-Grants mit Pfad-/Kommandomuster-Scope + Task-Bindung
      im Policy-Engine umsetzen; Audit-Log trägt den aktiven Grant sichtbar
      (und damit sofort in der P0-Matrix).
- [ ] Bulk-Run-UX: EIN Prompt für N gleichartige Aktionen (Vorschau der
      Muster-Abdeckung), statt 200 Einzel-Prompts; Ablehnung fällt auf
      Einzel-Prompts zurück.
- [ ] Adversarial-Testsuite (enumeriert, nicht nur Kategorien):
      (a) Scope `src/`, Schreibversuch `../etc/…` → deny;
      (b) Symlink `src/link → /etc`, Schreiben via Link → deny;
      (c) Sidecar-Restart mitten im Lauf → Grant NICHT wiederhergestellt
      ohne explizite Persistenz-Entscheidung des Menschen;
      (d) Task endet, neuer Task versucht denselben Scope → neuer Prompt.
- [ ] Manuelle Real-Abnahme (Runbook, reproduzierbar): echter Agent-Lauf
      mit ≥50 Datei-Schreibzugriffen unter einem Scoped-Grant — genau ein
      Prompt, sauberes Audit. Rollback-Kriterium: ergibt das Design-Review
      „nicht sicher umsetzbar" → zurück auf Session-Grants + Human-in-Loop,
      P2 bleibt blockiert.

## Phase 2 — Hintergrund-Läufe + Morning-Digest (Konsument von P1)

> **B: Nachtlauf-Realabnahme auf Matzes Maschine.** Ein Nachtlauf ohne
> Scoped-Grant bleibt am ersten Gate stehen — deshalb P1 zuerst.
> Council-Korrektur eingearbeitet: Headless-Sessions sind ein NEUER
> Lifecycle — Design-Schritt vor Bau, nicht „Semantik nebenbei".

- [ ] Design-Schritt Headless-Lifecycle (gated vor den Bau-Schritten):
      Terminierungs-Kriterien (Task fertig · Grant abgelaufen · manueller
      Stopp · Idle-Timeout), Persistenz (in-memory Store überlebt keinen
      Restart — was übersteht die Nacht, was nicht, ehrlich benannt),
      Ressourcen-Limits (max. Laufzeit, Token-Budget pro Lauf).
- [ ] Headless-Session-Semantik bauen: Session ohne gebundenen Editor/
      PTY-Fokus; nutzt bestehende Recovery-Primitive (Stall-Watchdog,
      Reconnect); Zustand jederzeit in der Matrix sichtbar (P0 ist das
      Fenster dazu).
- [ ] Scheduler-Primitiv im Sidecar: lokale, persistierte Zeitpläne
      (cron-artig, keine Server-Komponente); an/aus global + pro Plan;
      ehrlich benannt: kleines, aber NEUES Primitiv.
- [ ] Scheduler-Concurrency-Policy (Council-Neubefund, entschieden statt
      offen): max. 1 aktiver geplanter Lauf, weitere FIFO-Queue (Limit 5,
      darüber Drop + Warn-Signal); Test: 3 Pläne feuern gleichzeitig →
      1 läuft, 2 queued, Reihenfolge erhalten.
- [ ] Lauf-Rezepte v1: (a) „Roadmap-Phase abarbeiten" (nutzt bestehende
      Run-Loops), (b) „CI/PR-Wache" (Forge-Provider pollt, respektiert
      Rate-Limits). Jedes Rezept läuft unter einem expliziten, vorher
      erteilten Scoped-Grant; trifft es ein Gate → sauberes Pausieren.
- [ ] Digest-Composer mit Batch-Dedup (Council-Neubefund): identische
      Gate-Stopps gruppieren („47× Schreiben unter src/ geblockt"),
      sequenzielle Wiederholungen kollabieren („Phase X: 3 Versuche,
      zuletzt gescheitert bei Schritt Y"), Längen-Cap (~500 Zeilen,
      Rest als „… und N weitere Ereignisse"); Ausgabe → SignalFlyout +
      Markdown-Report im Projekt; keine neue Notification-Schiene.
- [ ] Adversarial-Tests: pausierter Lauf eskaliert nichts, merkt sich keine
      Freigaben, Digest enthält nie Secret-Werte (Referenzen only).
- [ ] Manuelle Real-Abnahme (Runbook mit festem Setup: welche Phase,
      welcher Grant, Pass-Kriterien enumeriert): ein echter Nachtlauf über
      eine kleine Roadmap-Phase, morgens Digest mit Diff-Links und
      Gate-Stopps. Rollback-Kriterium: terminieren Headless-Sessions nicht
      zuverlässig → Scheduler archivieren, manuelle Lang-Läufe behalten.

## Phase 3 — Trace-Lernschleife (Routing-Kalibrierung aus echten Läufen)

> Verstärkt real-breadth P2 (Klasse-C: „an echten Läufen kalibrieren") —
> kein neuer Kern, eine Auswertung. Ehrlichkeit: Ersparnis oft kleiner als
> erhofft (Double-Run-Kosten).

- [ ] Trace-Auswertung: Session-Store + Telemetrie + Quality-Verdicts zu
      einem Kalibrier-Datensatz joinen (lokal).
- [ ] Scrubbing als Mechanismus (Council-Neubefund): Redaktions-Regeln
      (Env-Vars, Key-Muster, Pfad-Allowlist) implementiert + verifiziert —
      Test: bekanntes Secret in Trace injizieren → im Datensatz redigiert;
      manueller Audit eines Beispiel-Datensatzes vor erster Nutzung.
- [ ] Routing-Report: pro Task-Klasse gemessene Erfolgsquote/Kosten je
      Modell-Tier; Vorschlag konkreter Schwellwert-Anpassungen für
      `live-router.ts`/`escalation.ts` — Vorschlag, kein Auto-Apply.
- [ ] Anwenden hinter Setting + Rückweg: Mensch bestätigt Schwellwert-
      Änderung; alte Werte bleiben als Snapshot wiederherstellbar
      (Ein-Klick-Rollback); Blocklist-Invariante (Safety/Permission →
      großes Modell) bleibt unantastbar, strukturell vom Lernpfad
      ausgenommen.
- [ ] Messung stichproben- statt zeitraumbasiert (Council-Korrektur):
      mindestens ~200 Tasks vorher / ~200 nachher statt „1 Woche";
      Report nennt Erfolgsquote, Kosten-Delta und eine ehrliche
      Unsicherheits-Einschätzung; kein signifikanter Effekt → steht
      genau so drin. Rollback-Kriterium: verschlechtert eine angewandte
      Kalibrierung die Erfolgsquote spürbar → Snapshot zurück, Lernpfad
      pausieren.

## Phase 4 — Voice-I/O (opt-in, lokal, spät — mit eigenem Bleibt-oder-fliegt-Gate)

> Reiner Interaktionsmodus, ändert nicht, was der Agent kann. Default aus.
> Bewusst in der Sequenz gehalten (Council-Konvergenz): erst die minimale
> Version real bauen, DANN anhand echter Nutzung entscheiden — nicht vorab
> spekulativ nach `later/` schieben. **B: lokale STT/TTS-Toolchain
> (whisper.cpp-Klasse) on demand pro Projekt provisioniert, nie in den
> Core gebündelt (Footprint-These).**

- [ ] STT: Diktat in den Composer (Push-to-talk, KEIN Always-Listening in
      v1); lokale Engine, on-demand-Provision, sauberer Fallback wenn fehlt.
- [ ] TTS: „lies mir X vor" für Status/Digest/Fehler; lokale Stimme.
- [ ] Privacy-Nachweis auf Netzwerk-Ebene (Council-Korrektur — statische
      „kein fetch im Modul"-Prüfung reicht nicht): Laufzeit-Test mit
      Netz-Monitor — während STT/TTS null Pakete an nicht-localhost;
      Dependency-Audit der Engines auf Telemetrie-/License-Phone-home-Flags,
      in der Provisionierung deaktiviert.
- [ ] Bleibt-oder-fliegt-Gate (explizit, siehe Akzeptanzkriterien):
      manuelle Abnahme + Entscheidung — bleibt Voice drin, oder wandert der
      Rest (Always-Listening, Wake-Word) dauerhaft nach `later/`?
      Rollback-Kriterium: fügt Voice irgendeinem Nicht-Voice-Pfad Latenz
      oder residente Kosten hinzu → dauerhaft archivieren.

## Phase 5 — Ehrlichkeits-Review (leichtgewichtig, lokal — kein Produkt-Telemetrie-Programm)

> Council schlug produktweite Nutzungs-Telemetrie vor — verworfen
> (lokal-first, internes Tool). Stattdessen: eine bewusste, lokale
> Keep-or-Archive-Runde nach realer Nutzung — dieselbe Weglass-Disziplin
> wie im Konzept (§9.5).

- [ ] Nach ~4 Wochen realer Nutzung pro Feature entscheiden (lokale
      Evidenz reicht: eigene Nutzung, Digest-Historie, Matrix-Öffnungen):
      Matrix · Hintergrund-Läufe · Lernschleife · Voice — behalten,
      nachschärfen oder archivieren; Ergebnis als kurze Notiz in
      `DECISIONS.md`, Roadmap-Checkboxen entsprechend schließen.

---

## Nicht-Ziele (Ownership liegt anderswo — hier nicht duplizieren)

| Thema | Gehört zu |
|---|---|
| Tauri-Transport, Fenster-Chrome | actually-works P7/P8 |
| USD-Kostenrechnung, RTK/Caveman, Token-Economy | real-breadth P2 |
| Datasource, Browser-Fläche | real-breadth P1/P4 (Gates G-PROD-RO, G-BROWSER) |
| Sentry-Tiefe | road-to-sentry-observability |
| Composer-Cockpit (Edit-&-Rerun, Queue, Steering) | road-to-composer-intelligence P5 |
| Signierte Builds/Release | road-to-desktop-release |

## Akzeptanzkriterien

- Matrix offen = live und flüssig (auch bei 100+ Knoten, mit Fallback);
  Matrix zu = beweisbar null Kosten — dauerhaft per Leck-Test, nicht einmalig.
- Federation: mehrere offene IDEs, eine Matrix auf „alle" zeigt alles;
  Scope-Toggles greifen live; Klick auf fremden Agent fokussiert die
  richtige IDE mit der laufenden Session; außerhalb des Scopes null
  Remote-Subscriptions; alles same-machine/same-user, kein Netzpfad.
- Ein 50-Datei-Agent-Lauf braucht genau einen Grant-Prompt.
- Ein Nachtlauf produziert morgens einen ehrlichen, deduplizierten Digest
  inkl. Gate-Stopps; jede Real-Abnahme folgt einem reproduzierbaren Runbook.
- Routing-Kalibrierung hat mindestens einen stichproben-basierten
  Vorher/Nachher-Report mit Ein-Klick-Rollback.
- Voice hat sein Bleibt-oder-fliegt-Gate durchlaufen und eine dokumentierte
  Entscheidung.
- Kein Gate wurde für Ambient-Läufe gelockert; alle Invarianten-Tests grün.
