# Headless-Session-Lifecycle — Design (Design-Gate, road-to-agent-matrix-and-ambient P2)

*Design-Gate-Artefakt. Dieses Dokument muss vorliegen + einen Design-Review
durch Matze (+ zweiten unabhängigen Council-Review) bestehen, BEVOR der Bau-
Schritt (P2 Z. 256 „Headless-Session-Semantik bauen") beginnt. Council-Korrektur
eingearbeitet: Headless-Sessions sind ein NEUER Lifecycle — Design-Schritt vor
Bau, nicht „Semantik nebenbei".*

> **GATE-STATUS: ⏳ ENTWURF — wartet auf Design-Review durch Matze.** Autonom
> gezeichneter Erstentwurf als Review-Input. **Blockiert zusätzlich auf P1**
> (Scoped-Grant): ein Nachtlauf ohne Scoped-Grant bleibt am ersten Gate stehen —
> siehe `scoped-grant-ux.md`. Kein Headless-Code, bis P1 gelandet UND dieser
> Entwurf freigegeben ist. Rollback bei „terminieren nicht zuverlässig" →
> Scheduler archivieren, manuelle Lang-Läufe behalten.

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

## 9. Referenzen

- `app/sidecar/acp/stall-watchdog.ts` — Idle-Timeout-Primitiv (Ist-Stand).
- `app/src/lib/sidecar/client/reconnecting-client.ts` — Reconnect (Ist-Stand).
- `app/sidecar/session/in-memory-session-store.ts` — Persistenz-Ist-Stand.
- `app/src/shell/agents/store.ts` — `RunState`, `cancelRun`, `completeRun`.
- `scoped-grant-ux.md` — P1-Gate, auf das P2 blockiert.
- road-to-agent-matrix-and-ambient.md Phase 2 (Z. 244–283).
