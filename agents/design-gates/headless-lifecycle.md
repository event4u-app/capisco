# Headless-Session-Lifecycle — Design (Design-Gate, road-to-agent-matrix-and-ambient P2)

*Design-Gate-Artefakt. Dieses Dokument muss vorliegen + einen Design-Review
durch Matze (+ zweiten unabhängigen Council-Review) bestehen, BEVOR der Bau-
Schritt (P2 Z. 256 „Headless-Session-Semantik bauen") beginnt. Council-Korrektur
eingearbeitet: Headless-Sessions sind ein NEUER Lifecycle — Design-Schritt vor
Bau, nicht „Semantik nebenbei".*

> **GATE-STATUS: ⛔ FAIL** (Council-Pre-Review 2026-07-06, Vollständigkeits-Linse
> gegen Entwurf + echten Code). Der Entwurf ist eine ehrliche Karte, behauptet
> aber Komposition + Sicherheits-Garantien, die der Code nicht trägt: von 6
> Terminierungs-Kriterien hat nur **eines** (Idle-Timeout) erzwingenden Code, und
> die zentrale „pausiert-nie-eskaliert"-Invariante ist vom realen `ask`-Gate
> **widerlegt** (es **auto-denyt** nach 5 min). **Kein Headless-Code, bis die in
> § Council Pre-Review gelisteten Blocker adressiert + von Matze reviewed sind.**
> Blockiert zusätzlich auf P1 (Scoped-Grant, `scoped-grant-ux.md`). Rollback bei
> „terminieren nicht zuverlässig" → Scheduler archivieren, manuelle Lang-Läufe
> behalten.

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

## 9. Referenzen

- `app/sidecar/acp/stall-watchdog.ts` — Idle-Timeout-Primitiv (Ist-Stand).
- `app/src/lib/sidecar/client/reconnecting-client.ts` — Reconnect (Ist-Stand).
- `app/sidecar/session/in-memory-session-store.ts` — Persistenz-Ist-Stand.
- `app/src/shell/agents/store.ts` — `RunState`, `cancelRun`, `completeRun`.
- `scoped-grant-ux.md` — P1-Gate, auf das P2 blockiert.
- road-to-agent-matrix-and-ambient.md Phase 2 (Z. 244–283).
