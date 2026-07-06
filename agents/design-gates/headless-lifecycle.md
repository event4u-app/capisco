# Headless-Session-Lifecycle — Design (Design-Gate, road-to-agent-matrix-and-ambient P2)

*Design-Gate-Artefakt. Dieses Dokument muss vorliegen + einen Design-Review
durch Matze (+ zweiten unabhängigen Council-Review) bestehen, BEVOR der Bau-
Schritt (P2 Z. 256 „Headless-Session-Semantik bauen") beginnt. Council-Korrektur
eingearbeitet: Headless-Sessions sind ein NEUER Lifecycle — Design-Schritt vor
Bau, nicht „Semantik nebenbei".*

> **GATE-STATUS: 🟡 v2.1 — CONDITIONAL; wartet auf Matze-Sign-off + P1-Landung.**
> Trajektorie: v1 ⛔ FAIL (GAP-1/2/5 gate-blockierend) → v2 🟡 CONDITIONAL → **§ v2.1
> Re-Review** unten schärft jeden Punkt (GAP-5 Digest ohne Freiform-`target`, GAP-1
> Pause-statt-Hang + Resume, Terminal-State, Epoch-Storage, GAP-8-Headline).
> **Kein Headless-Code, bis Matze v2.1 abzeichnet UND P1 (Scoped-Grant) gelandet
> ist.** Rollback bei „terminieren nicht zuverlässig" → Scheduler archivieren,
> manuelle Lang-Läufe behalten.

## 0. Was eine Headless-Session ist (und was nicht)

Eine Session **ohne** gebundenen Editor-/PTY-Fokus — sie läuft weiter, während
der Mensch woanders ist (oder schläft), und produziert morgens einen Digest.
Sie ist **kein** neuer Agent-Fähigkeits-Kanal: sie kann exakt das, was eine
interaktive Session kann, nur ohne Vordergrund-Fokus. Der gefährliche Teil ist
nicht „was sie tut", sondern **„wann und wie sie sicher aufhört"** — deshalb
dieses Gate.

## 1. Was heute existiert (Ist-Stand, geerdet am Code)

- **Run-State:** `RunState = "ready" | "loading" | "error"`
  (`app/src/shell/agents/store.ts`), pro Session in `runStates`.
- **Stall-Watchdog:** `app/sidecar/acp/stall-watchdog.ts` — ein Lauf ohne Event
  für zu lange gilt als hängend; feuert **einmal**, Transport wird sauber
  abgebrochen, Status wird recoverable `error`; Resume via Retry-as-Branch am
  Session-Tree. Rein `setTimeout`, deterministisch testbar.
- **Reconnect:** `app/src/lib/sidecar/client/reconnecting-client.ts` — erkennt
  unerwarteten Transport-Tod, Reconnect mit gecapptem exponentiellem Backoff,
  danach `onReconnect` → UI liest den (persistenten) Session-Tree neu.
- **Session-Store:** `app/sidecar/session/in-memory-session-store.ts` — **rein
  in-memory**, überlebt **keinen** Sidecar-Restart.
- **Matrix (P0):** die Session-/Subagent-Projektionen zeigen den Zustand bereits
  live an — das Fenster für Headless-Zustand existiert.

**Lücke gegenüber P2:** keine Terminierungs-Kriterien für einen fokuslosen Lauf,
keine Ressourcen-Limits (max. Laufzeit / Token-Budget pro Lauf), und die
Persistenz-Frage („was übersteht die Nacht?") ist nicht ehrlich benannt.

## 2. Was gebaut wird (Scope des Deltas)

1. **Headless-Session-Semantik:** eine Session, die ohne Editor/PTY-Fokus läuft,
   die bestehenden Recovery-Primitive (Stall-Watchdog, Reconnect) wiederverwendet
   und deren Zustand jederzeit in der P0-Matrix sichtbar ist.
2. **Terminierungs-Kriterien** (§3) — der Kern des Gates.
3. **Persistenz-Ehrlichkeit** (§4) — was die Nacht übersteht, was nicht.
4. **Ressourcen-Limits** (§5) — max. Laufzeit + Token-Budget pro Lauf.

**Nicht-Ziele:** kein Scheduler (das ist P2 Z. 260, eigenes Sidecar-Primitiv,
konsumiert diesen Lifecycle); keine Server-Komponente; keine Lockerung eines
Broker-Gates — ein Headless-Lauf trifft dieselben Gates wie ein Vordergrund-Lauf
(und pausiert sauber, statt zu eskalieren).

## 3. Terminierungs-Kriterien (der Kern)

Eine Headless-Session endet bei **irgendeinem** dieser Ereignisse — je zuerst:

| Kriterium | Auslöser | Ergebnis |
|---|---|---|
| **Task fertig** | Run-Loop meldet Abschluss | `ready`, Session bleibt lesbar, Grant (P1) verfällt |
| **Grant abgelaufen** | Scoped-Grant (P1) endet mit dem Task | nächste mutierende Aktion → `ask`; ohne Mensch → **Pause**, keine Eskalation |
| **Manueller Stopp** | Mensch stoppt in der Matrix | `ready`, sofort, wie interaktives Stop (nutzt bestehenden `cancelRun`) |
| **Idle-Timeout** | kein Event für N (Stall-Watchdog) | recoverable `error`, Resume via Retry-as-Branch |
| **Max-Laufzeit** | Wall-Clock-Cap überschritten (§5) | `ready` + Digest-Notiz „durch Zeit-Limit beendet" |
| **Token-Budget** | Budget pro Lauf erschöpft (§5) | `ready` + Digest-Notiz „durch Budget beendet" |

**Invariante:** trifft ein Headless-Lauf ein Broker-Gate, das ein `ask`
erfordert, und es ist kein Mensch da → er **pausiert** (merkt sich **keine**
Freigabe, eskaliert **nicht** selbst). Das ist der Kern-Sicherheitspunkt und
wird adversarial getestet (P2 Z. 277).

## 4. Persistenz — ehrlich benannt

| Zustand | Übersteht Sidecar-Restart? | Warum |
|---|---|---|
| Session-**Transkript** / Tree | **Nein** (heute in-memory) | `in-memory-session-store.ts` — bewusst, bis eine echte Persistenz-Schicht existiert |
| Scoped-**Grant** (P1) | **Nein** (bewusst) | Abuse-Case A3 in `scoped-grant-ux.md`: ein Restart darf einen Grant **nie** automatisch wiederherstellen |
| **Laufender** Headless-Task | **Nein** | ein Restart mitten im Lauf beendet ihn; morgens steht im Digest „durch Neustart unterbrochen" |
| **Digest** (Markdown-Report) | **Ja** (in den Projekt-Dateien) | der Digest ist das dauerhafte Artefakt, nicht der Laufzeit-Zustand |

Ehrliche Konsequenz: ein Nachtlauf, der einen Sidecar-Restart erlebt, ist
**nicht** nahtlos fortsetzbar — er endet und meldet das morgens. Das ist bewusst
sicherer als eine fragile Auto-Resume-Logik, die Grants oder halbe Zustände
wiederherstellt. Eine echte Persistenz-Schicht ist ein **späteres** Primitiv
(nicht in P2).

## 5. Ressourcen-Limits (pro Lauf)

- **Max-Laufzeit:** Wall-Clock-Cap (Vorschlag Default: konservativ, z. B. ein
  paar Stunden) — überschritten → sauberes Ende + Digest-Notiz.
- **Token-Budget pro Lauf:** ein hartes Budget; erschöpft → sauberes Ende +
  Digest-Notiz. (Konsumiert das bestehende Budget-Meter, sobald real — bis dahin
  die Mock-Budget-Facade.)
- **Idle-Timeout:** über den bestehenden Stall-Watchdog (kein neues Primitiv).
- Alle drei sind **defense-in-depth** gegen einen weglaufenden Nachtlauf; jedes
  Ende ist im Digest sichtbar (keine stillen Stopps).

## 6. Sichtbarkeit + Kein-Secret-Leak

- Jeder Zustandswechsel schreibt einen `AuditEntry` (kein Wert, nur
  `credentialRef`-Name) → erscheint im `BrokerTicker` / der Matrix.
- Der Digest (P2 Z. 271) enthält **nie** Secret-Werte — nur Referenzen; das ist
  adversarial getestet (P2 Z. 277: „Digest enthält nie Secret-Werte").
- Ein pausierter Lauf merkt sich **keine** Freigaben (siehe §3-Invariante).

## 7. Offene Fragen an das Review (Matze + Council)

- **Q1** — Default-Werte für Max-Laufzeit + Token-Budget? Zu eng = nächtliche
  Läufe brechen früh ab; zu weit = ein weglaufender Lauf verbrennt Budget.
- **Q2** — Idle-Timeout für Headless identisch zum interaktiven Stall-Watchdog,
  oder länger (ein Nachtlauf darf legitim länger „still" denken)?
- **Q3** — Soll ein durch Restart unterbrochener Lauf einen **Wiederaufnahme-
  Vorschlag** im Digest anbieten (Mensch entscheidet morgens), oder ganz
  verworfen werden?
- **Q4** — Reihenfolge: baut P2 zwingend erst nach P1-Gate-Pass, oder darf die
  Headless-**Semantik** (ohne Bulk-Grant) schon vorher gegen Session-Grants +
  Human-in-Loop laufen (langsamer, aber unblockiert)?

## 8. Akzeptanzkriterien (werden Runbook bei Gate-Pass)

- Alle sechs Terminierungs-Kriterien (§3) deterministisch getestet (Fake-Timer,
  kein echter Agent).
- Adversarial (P2 Z. 277): pausierter Lauf eskaliert nichts, merkt sich keine
  Freigaben, Digest enthält nie Secret-Werte.
- Zustand jederzeit in der P0-Matrix sichtbar.
- Manuelle Real-Abnahme (P2 Z. 279): ein echter Nachtlauf über eine kleine
  Roadmap-Phase, morgens Digest mit Diff-Links + Gate-Stopps — **nach** Gate-Pass
  + P1, auf Matzes Maschine.

## Council Pre-Review (2026-07-06)

Vollständigkeits-Linse (Terminierung / Eskalation / Secret-Leak) gegen Entwurf +
echten Code. **Verdict: FAIL** — GAP-1, GAP-2, GAP-5 sind einzeln gate-blockierend.

### Gate-blockierende Gaps

1. **GAP-1 (CRITICAL) — „pausiert-nie-eskaliert" ist aspirational; das reale
   Primitiv AUTO-DENYT.** Das einzige, was ein `ask` auf einer Live-Session klärt,
   ist die `PendingPermissionRegistry` — Default ist ein fail-closed Timer, der
   nach 5 min `deny` settlet (`pending-permission-registry.ts:67,127`). Ein
   Nachtlauf ohne Mensch → park → 5 min → **auto-deny** → der Agent läuft auf
   einer verweigerten Capability weiter (Retry/schlechterer Pfad/falsches „user
   declined"). `deny` ≠ `pause`. Es gibt **kein** Pause-Primitiv. → dritter
   Resolver-Ausgang `pause` (suspendiert den Lauf, `paused`-State, überlebt bis
   Mensch oder Terminierungs-Kriterium). Test: Headless + Timeout → `paused`,
   **kein** `deny` an den Broker, Run-Loop steht.
2. **GAP-2 (CRITICAL) — Max-Laufzeit hat KEINEN erzwingenden Code** („run
   forever"): ein aktiver-aber-nicht-konvergierender Lauf kickt den StallWatchdog
   endlos (`stall-watchdog.ts:28`); kein Wall-Clock-Cap existiert (grep
   `maxRuntime|wallClock` = 0 Treffer). → zweiter Watchdog, **nicht** von Events
   gekickt, einmal bei Run-Start armiert. Fake-Timer-Test: 60s-Kicks terminieren
   trotzdem am Cap.
3. **GAP-5 (HIGH) — Digest-Secret-Leak-Garantie hat kein Redaktions-Mechanismus.**
   §6 behauptet „nie Secret-Werte" als garantiert; es gibt **kein** Digest-Modul
   und keinen Scrubber. `looksLikeSecretValue` (`audit-store.ts:83`) prüft nur das
   `credentialRef`-Feld des Audit-Logs, nicht Transkript-Bodies. → Digest als
   Projektion NUR über strukturierte Referenzen (Audit-Einträge + Diff-Links +
   Gate-Stop-Records), nie rohe Transkript-Zeilen; Test: Token-förmiger String im
   Transkript → im Digest **absent**.

### Weitere Gaps (fix vor Bau)

- **GAP-3 (HIGH) — Token-Budget unerzwingbar:** das Budget-Meter ist eine
  Frontend-Mock-Facade (`store.ts:153`, `budget: 200_000` reine UI-Projektion);
  kein Token-Accounting im Run-Loop. → entweder aus dem Gate descopen (explizit)
  oder echten Sidecar-Zähler bauen.
- **GAP-4 (MED) — kein Terminierungs-Arbiter:** zwei gleichzeitig feuernde
  Kriterien → Double-Settle / stale Timer auf toter Session. → ein Arbiter, der
  beim ersten Kriterium StallWatchdog + (künftigen) Runtime-Cap + geparkte
  Permission cancelt.
- **GAP-6 (MED) — „Grant abgelaufen" hat kein Expiry-Modell:** referenziert das
  P1-Konzept, das noch keinen Expiry trägt (Grants persistieren bis Prozess-Tod).
  → in P1 konkret spezifizieren; bis dahin diese Zeile als blocked markieren.
- **GAP-7 (MED) — Restart ≠ Blip nicht unterscheidbar:** `ReconnectingSidecarClient`
  behandelt jeden Close gleich (`reconnecting-client.ts:108`); ein echter
  Sidecar-Restart (in-memory Store weg) liest still einen leeren Tree neu statt
  „interrupted" zu melden. → Boot-Epoch/Nonce im Reconnect-Handshake; bei Wechsel
  laufenden Headless-Run terminal `interrupted`.
- **GAP-8 (MED) — `RunState` hat kein `paused`/`interrupted`:** `RunState =
  "ready"|"loading"|"error"` (`store.ts:9`) kann die sicheren Ausgänge nicht
  darstellen; ein pausierter Lauf kollabiert zu `loading` (wirkt normal) oder
  `error` (wirkt kaputt). → `RunState` um `paused`+`interrupted` erweitern, in der
  Matrix distinkt rendern.

### Was der Entwurf richtig hatte (Council-Konsens)

Die **Persistenz-Ehrlichkeit (§4)** ist code-akkurat und stark (kein fragiles
Auto-Resume); der **Idle-Timeout** ist real verdrahtet (`live-agent-provider.ts:177`);
das **Grant-Modell launert keine Untrusted-Egress-Freigaben** (starke Basis);
der **Audit-Stream trägt nie Secret-Werte** — der Gap ist nur, dass der Entwurf
diese Garantie auf den (ungebauten) Digest über-dehnt.

## v2 — Blocker-Auflösung (2026-07-06, post-Council)

Jeder GAP wird konkret + code-geerdet aufgelöst. GAP-1/2/5 waren gate-blockierend.

1. **GAP-1 — echtes Pause-Primitiv statt Auto-Deny.** Neuer, dritter Resolver-
   Ausgang `pause` (heute nur `allow`/`deny`): eine Headless-Session ohne
   anwesenden Menschen, die ein `ask` trifft, geht in State `paused` (GAP-8),
   **ohne** einen `deny` an den Broker zu emittieren und **ohne** den Run-Loop
   voranzutreiben. Konkret: die `PendingPermissionRegistry` bekommt einen
   **Headless-Modus** — statt des 5-min-fail-closed-`deny`-Timers
   (`pending-permission-registry.ts:67,127`) parkt sie den Request **unbegrenzt**
   und markiert die Session `paused`; Auflösung erst durch Mensch (morgens) oder
   ein Terminierungs-Kriterium. Interaktive Sessions behalten den `deny`-Timer.
   Der Grant wird **nie** gemerkt (kein Auto-Approve über Nacht).
2. **GAP-2 — Wall-Clock-Cap-Watchdog.** Ein zweiter Watchdog neben dem
   StallWatchdog, **einmal bei Run-Start armiert** und **nicht** von Events
   gekickt (`stall-watchdog.ts:kick` gilt nur für Idle). Überschreitung → sauberes
   Ende + Digest-Notiz „durch Zeit-Limit beendet". Deterministisch mit Fake-Timern
   testbar (60s-Kicks terminieren trotzdem am Cap).
3. **GAP-3 — Token-Budget aus dem Gate DESCOPED (explizit).** Es gibt heute kein
   Sidecar-seitiges Token-Accounting (das Meter ist eine Frontend-Mock-Facade,
   `store.ts:153`). Der Wall-Clock-Cap (GAP-2) deckt den Runaway-Fall. Der harte
   Token-Cap wird **nachgezogen, sobald ein echter Sidecar-Zähler existiert** —
   bis dahin ausdrücklich **kein** Gate-Akzeptanzkriterium (statt einer Mock-
   Garantie, die nichts erzwingt).
4. **GAP-4 — ein Terminierungs-Arbiter.** Genau eine Stelle entscheidet „je
   zuerst": beim ersten feuernden Kriterium cancelt sie StallWatchdog +
   Wall-Clock-Cap + eine geparkte Permission (GAP-1) und setzt genau **einen**
   Terminal-State. Kein Double-Settle, keine stale Timer auf toter Session
   (Test: zwei Kriterien im selben Tick → ein Terminal-State).
5. **GAP-5 — Digest ist reine Referenz-Projektion.** Der Morning-Digest wird
   **ausschließlich** aus strukturierten Referenzen gebaut: Audit-Einträge (die
   per Konstruktion nie Secret-Werte tragen, `audit-store.ts:83`), Diff-Links,
   Gate-Stop-Records. **Nie** rohe Transkript-Bodies. Damit ist „nie Secret-Werte"
   eine strukturelle Eigenschaft, kein Scrubber, der versagen kann (dasselbe
   PII-exclusion-by-construction-Prinzip wie beim Audit-Log). Test: Token-förmiger
   String im Transkript → im Digest absent.
6. **GAP-6 — Grant-Expiry via Scoped-Grant-v2.** „Grant abgelaufen" ist jetzt
   konkret: task-completion-bound über `endTask(taskId)` aus scoped-grant-ux.md
   v2 (Auflösung 2) — dasselbe Live-Task-Registry-Primitiv. Kein separates
   Expiry-Modell nötig.
7. **GAP-7 — Restart-Erkennung via Boot-Epoch.** Der Sidecar bekommt eine
   Boot-Epoch/Nonce; der Reconnect-Handshake (`reconnecting-client.ts:108`)
   vergleicht sie. Epoch-Wechsel = echter Prozess-Restart (in-memory Store weg) →
   der laufende Headless-Run wird terminal `interrupted` markiert (GAP-8) statt
   still einen leeren Tree neu zu lesen. Ein reiner Transport-Blip (gleiche Epoch)
   reconnektet nahtlos wie bisher.
8. **GAP-8 — `RunState` um `paused` + `interrupted` erweitert.** Heute
   `"ready"|"loading"|"error"` (`store.ts:9`). Beide neuen States rendern distinkt
   in der P0-Matrix (paused = „wartet auf Dich", nicht error-rot; interrupted =
   „Neustart hat den Lauf beendet"). Das ist reine Frontend/Store-Arbeit und der
   **erste autonom baubare Headless-Slice** — er kann VOR dem gegateten Pause-
   Primitiv landen (Groundwork), sofern das als eigener Schritt gewünscht ist.

### Residual / Reihenfolge
- **P1 zuerst:** GAP-6 hängt an scoped-grant-ux v2 (endTask). Der Headless-Bau
  startet nach P1-Landung + Matze-Sign-off.
- **GAP-8 (RunState)** ist der einzige v2-Teil, der schon jetzt ohne P1/Gate
  baubar wäre (reine Typ-/UI-Erweiterung) — bewusst NICHT spekulativ gebaut, bis
  Matze ihn als eigenen Slice freigibt (er wäre sonst UI für ein gegatetes Feature).

## v2 Re-Review (2026-07-06)

Vollständigkeits-Linse gegen die v2-Auflösung + echten Code. **CONDITIONAL**
(v1 war FAIL). GAP-1/2/4/6 sind wie entworfen schließbar; drei Punkte brauchen
v2.1-Schärfung, einer (GAP-5) war derselbe Über-Claim-Typ wie v1.

### v2.1 — verbindliche Schärfungen

1. **GAP-5 neu geschnitten (war leaning-FAIL).** Der „strukturell, kein Scrubber"-
   Claim ist **falsch**: `looksLikeSecretValue` (`audit-store.ts:83`) schützt nur
   das `credentialRef`-**Namensfeld**, NICHT `AuditEntry.target` — und `target` ist
   der agent-gelieferte Freiform-Wert (`acp-session.ts:350`, z. B. eine `Bash`-
   Kommandozeile `curl -H "Authorization: Bearer sk-…"`). Ein Digest aus Audit-
   Einträgen erbt dieses Freiform-Feld. **Fix:** der Digest projiziert eine
   **bounded** Teilmenge — `{ capability-kind, credentialRef-Name, outcome, seq,
   diff-link-id }` — und **schließt `target` explizit aus** (oder redigiert `target`
   mit `looksLikeSecretValue`-Klasse, dann aber den „kein Scrubber"-Claim streichen).
   Der v2-Test muss den Secret-über-`target`-Pfad prüfen (nicht nur Transkript-Body).
2. **GAP-1 Pause vs. Hang + Resume + Watchdog-Kollision.** Das „park unbegrenzt"
   ist heute ein **Hang** (der Resolver wird in einem JSON-RPC-Handler awaited,
   `acp-session.ts:383` — ein nie-auflösendes Promise = hängender Agent-Request).
   v2.1 muss festschreiben: (a) der Idle-StallWatchdog wird **explizit supprimiert**,
   solange `paused` (sonst kollabiert Pause zu `error`); (b) das **Resume-Protokoll**
   (Sidecar noch up → `resolvePermission` settlet den geparkten Request; Sidecar
   neugestartet → `paused` wird `interrupted`, nicht resumebar); (c) `#park`'s
   supersede-`deny` (`pending-permission-registry.ts:110`) darf einen headless-
   `paused`-Eintrag **nicht** treffen (sonst kehrt der Auto-Deny von GAP-1 zurück).
3. **GAP-2/4 Terminal-State + Arbiter-Deny.** Wenn der Wall-Clock-Cap auf einen
   `paused`-Run trifft: Terminal-State ist **`interrupted`** (nicht `ready` — ein
   an einem Gate gestrandeter, dann guillotinierter Run ist nicht „sauber fertig").
   Und: der Arbiter, der die geparkte Permission cancelt, **emittiert dabei einen
   `deny`** an den Broker-Seam (`registry.ts:#clear` nimmt eine `PermissionDecision`)
   — die GAP-1-Formulierung „emittiert nie deny" gilt nur, **bis** ein
   Terminierungs-Kriterium feuert; dann muss es. Festschreiben.
4. **GAP-3 Kosten-Residual benannt.** Der Wall-Clock-Cap bound Wall-Clock, **nicht
   Spend** — ein Tight-Loop kann im Fenster viel Token/Kosten verbrennen. v2.1 nennt
   das Residual explizit in §5 + Akzeptanz („zeit-, nicht kostengebunden; Worst-Case
   = Modellrate × Cap"), statt es als voll gedeckt darzustellen.
5. **GAP-7 Epoch-Storage + Consumer-Landing.** Die Boot-Epoch muss **in-memory bei
   Boot** gemünzt werden (ändert sich bei echtem Restart) und im `initialize`/
   `session/new`-Handshake zurückgegeben — **nie auf Platte persistiert** (sonst
   sieht ein Restart wie ein Blip aus). UND: es gibt heute **keinen `onReconnect`-
   Consumer** in `app/src` (`reconnecting-client.ts:105` — Callback ohne Abonnent);
   v2.1 nennt die Landing-Site, wo der Epoch-Vergleich + `interrupted`-Übergang
   verdrahtet wird, sonst hat GAP-7 keinen Ort.
6. **GAP-8 Headline korrigiert.** Der v2-Text widersprach sich (baubar-jetzt vs.
   nicht-spekulativ). Korrekt: das Union-Mitglied `paused`/`interrupted` +
   Fallback-Render darf jetzt landen; die **distinkte** „wartet-auf-Dich"-Darstellung
   wird **mit dem Pause-Produzenten** gegatet (State ohne Produzent = tote/irreführende
   UI). Kein „unabhängig wertvolles Groundwork".

### Was v2 richtig hatte
GAP-4 (Arbiter, erstes-Kriterium-gewinnt) + GAP-2 (zweiter, nicht-gekickter
Watchdog) sind sauber + deterministisch testbar; GAP-6 bindet Grant-Expiry
ehrlich an das P1-`endTask`-Primitiv (gute Dependency-Hygiene); die
Persistenz-Ehrlichkeit (§4) übersteht die Re-Review; kein Gate-Loosening für
Headless. **Nächster Schritt:** v2.1 ist Wiring-vollständig; Matze zeichnet ab
(oder optionale 3. Runde), Bau folgt **nach** P1-Landung.

## 9. Referenzen

- `app/sidecar/acp/stall-watchdog.ts` — Idle-Timeout-Primitiv (Ist-Stand).
- `app/src/lib/sidecar/client/reconnecting-client.ts` — Reconnect (Ist-Stand).
- `app/sidecar/session/in-memory-session-store.ts` — Persistenz-Ist-Stand.
- `app/src/shell/agents/store.ts` — `RunState`, `cancelRun`, `completeRun`.
- `scoped-grant-ux.md` — P1-Gate, auf das P2 blockiert.
- road-to-agent-matrix-and-ambient.md Phase 2 (Z. 244–283).
