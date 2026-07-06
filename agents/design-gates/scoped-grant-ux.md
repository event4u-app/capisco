# Scoped-Grant-UX — Design + Threat-Model (Design-Gate, road-to-agent-matrix-and-ambient P1)

*Design-Gate-Artefakt. Dieses Dokument muss vorliegen + einen Design-Review
durch Matze (+ zweiten unabhängigen Council-Review) bestehen, BEVOR der Broker-
Bau-Schritt (P1 Z. 226 „`scoped`-Grants im Policy-Engine umsetzen") beginnt. Es
wird bei Bestehen zur Acceptance-as-Runbook der Adversarial-Testsuite (P1 Z. 232).*

> **GATE-STATUS: 🟡 v2.1 — CONDITIONAL, Wiring-vollständig; wartet auf Matze-Sign-off
> (oder optionale 3. Runde).** Trajektorie: v1 ⛔ FAIL (3 Linsen) + 3 latente
> Shipped-Code-Bugs (shell-Trifecta, Symlink-Escape, Key-Kollision — **alle gefixt**,
> PRs #31–#33) → v2 🟡 CONDITIONAL (**A1/A2-Root-Boundary bestätigt geschlossen**,
> kein Escape mehr; nur Wiring-Specs offen) → **§ v2.1** unten schreibt jede
> Wiring-Spec fest (canonical-Target, Ordering, taskId-Durchreichung, Res-7-neu,
> Case-Fold, Prefix-Kanonisierung). **Kein `scoped`-Grant-Code, bis Matze v2.1
> final abzeichnet** (der Bau folgt dann Spec + der enumerierten A1–A9-Testsuite).
> Fallback: manuelle Session-Grants + Human-in-Loop — P2 bliebe dann blockiert.

## 0. Warum dieses Gate (security-sensitive)

Ein Scoped-Grant erweitert die **Autorisierungs-Engine** (`GrantPolicyEngine`):
er lässt einen Agenten unter **einem** menschlichen OK **N** mutierende Aktionen
ausführen (z. B. „≥50 Datei-Schreibzugriffe unter `src/` für diesen Task"),
statt 50 Einzel-Prompts. Das ist genau der Punkt, an dem eine zu weite Grant-
Form still zur Rechteausweitung wird. Deshalb: erst Threat-Model + Review, dann
Code. Dieses Dokument benennt die Abuse-Cases und die strukturellen Gegenmittel,
gegen die die Implementierung dann verifiziert wird.

## 1. Was heute existiert (Ist-Stand, geerdet am Code)

`app/sidecar/broker/policy-engine.ts` + `app/src/contracts/broker.ts`:

- **Grant-Achse:** `GrantAxis = "once" | "session" | "scoped" | "deny"`. `scoped`
  existiert bereits, gebunden an einen `CapabilityScope` (heute schlicht ein
  `string`, ein „named scope").
- **Persistenz:** `GrantPolicyEngine.#grants: Map<string, GrantAxis>`, Key
  `` `${projectKey}:${kind}:${scope ?? ""}` ``. Rein **in-memory** — überlebt
  keinen Sidecar-Restart. Pro Projekt isoliert (`projectKey`).
- **Entscheidung** (`decide`): fail-closed (kein Match → `ask`); persistiertes
  `session`/`scoped` klärt gleiche `(kind, scope)`; persistiertes `deny` ist
  sticky.
- **Kein Forever:** `GrantAxis` hat keinen permanenten Wert (Invariante,
  test-verifiziert).
- **Lethal-Trifecta-Härtung** (§3.3): `fromUntrusted`-Egress
  (`file-write/network/db-write/external-write`) wird **hart** zu `ask` und kann
  **nie** von einem persistierten `session`/`scoped`-Grant vorgeklärt werden —
  ein human-cleared untrusted egress wird auf einen **single-use** Consumable
  (kind+target+command-gebunden) geklemmt.
- **Muster-Matching:** `AllowlistRule.pattern` ist glob-ish (`matches()`:
  trailing `*` = Präfix, sonst exakt) gegen `CapabilityRequest.target`.
- **Audit:** `AuditEntry` trägt Akteur + Capability + `target` + optionalen
  `credentialRef`-**Namen** (nie Wert), append-only; die P0-`BrokerTicker`
  (`app/src/shell/matrix/BrokerTicker.tsx`) rendert diesen Strom live.

**Lücke gegenüber P1:** Es gibt (a) **kein Task-Konzept** — Grants leben pro
`projectKey:kind:scope`, ohne Bindung an einen Lauf und ohne Ablauf; (b) der
`scoped`-Scope ist ein opaker String, **kein Pfad-/Kommandomuster** mit
Escape-Schutz; (c) `once`-Semantik ist einzelschuss, aber es fehlt der Mittelweg
„EIN OK → N gleichartige Aktionen, gebunden an einen Task".

## 2. Was gebaut wird (Scope des Deltas)

Ein **task-gebundener, muster-scoped Grant** als vierte praktische Nutzung der
bestehenden `scoped`-Achse — **ohne** eine neue Achse einzuführen:

1. **Grant-Shape:** `scoped`-Grant, dessen `CapabilityScope` von einem opaken
   String zu einem **strukturierten, kanonisierten Pfad-/Kommandomuster** wird,
   plus einer **Task-Bindung** (der Grant gilt nur, solange der ausstellende
   Task lebt).
2. **Task-Ende = Grant-Ende:** endet der Task (fertig · abgebrochen · Idle-
   Timeout · manueller Stopp), wird der Grant **verworfen** — kein Übertrag auf
   den nächsten Task.
3. **Anzeige:** der aktive Grant erscheint sichtbar in der P0-Matrix
   (`BrokerTicker`) — welcher Task, welcher Scope, wie viele Aktionen darunter.
4. **Widerruf:** ein Mensch kann den aktiven Grant jederzeit sofort widerrufen
   (nächste Aktion fällt auf `ask` zurück).
5. **Bulk-Run-UX** (P1 Z. 229): EIN Prompt zeigt die **Muster-Abdeckung**
   („dieser Grant deckt `file-write` unter `src/**` für Task X"), statt N
   Einzel-Prompts. Ablehnung fällt sauber auf Einzel-Prompts zurück.

**Nicht-Ziele:** kein Wildcard-Default, keine Persistenz über Sidecar-Restart
(siehe §4 A3), keine Lockerung der Lethal-Trifecta-Regel (§4 A5), kein Grant für
`secret-read`/`external-write` unter diesem Mechanismus (die bleiben Einzel-Gate).

## 3. Grant-Shape (Vorschlag zur Diskussion)

Konservativ, human-authored, kein Wildcard-Default. Vorgeschlagene strukturierte
Scope-Form (serialisiert weiterhin in den bestehenden `CapabilityScope`-String,
damit der `#grants`-Key-Mechanismus unverändert bleibt):

| Feld | Bedeutung | Beispiel |
|---|---|---|
| `taskId` | ausstellender Task; Grant stirbt mit ihm | `task-7` |
| `kind` | genau **eine** Capability-Art | `file-write` |
| `pathPrefix` | **kanonisierter** absoluter Präfix (realpath, siehe A2) | `<repo>/src/` |
| `commandPattern?` | für `shell`: glob-ish wie `AllowlistRule.pattern` | `pnpm test*` |
| `maxActions?` | optionales Zähl-Limit (defense-in-depth) | `200` |

Regeln:
- Der Grant gilt nur, wenn **`kind` exakt** passt UND `target` (nach realpath-
  Kanonisierung) **unter** `pathPrefix` liegt (bzw. `commandPattern` matcht).
- `file-read`/`db-read` sind hier **nicht** scoped-fähig gemacht (nur mutierende
  `file-write`; `shell` nur mit `commandPattern`). Read bleibt über den
  bestehenden Allowlist-Pfad.
- `secret-read`, `external-write`, `network`, `db-write` sind **ausgeschlossen**
  von diesem Mechanismus (Einzel-Gate bleibt) — sie sind die gefährlichsten
  Egress-/Secret-Kanten.

## 4. Abuse-Cases (zu verhindern) — deckt P1 Z. 232 ab

| # | Abuse-Case | Verhindert durch | Test (Z. 232) |
|---|---|---|---|
| A1 | Scope `src/`, Schreibversuch `../etc/passwd` | `pathPrefix`-Vergleich **nach** realpath-Kanonisierung; Ziel außerhalb → `deny` | (a) |
| A2 | Symlink `src/link → /etc`, Schreiben via Link | Kanonisierung folgt Symlinks (realpath des **Ziels**, nicht des Link-Pfads); liegt außerhalb `pathPrefix` → `deny` | (b) |
| A3 | Sidecar-Restart mitten im Lauf | Grant ist **in-memory** + task-gebunden → Restart verliert sowohl Task als auch Grant; **keine** automatische Wiederherstellung ohne neue, explizite menschliche Entscheidung | (c) |
| A4 | Task endet, neuer Task nutzt denselben Scope | Grant ist an `taskId` gebunden; neuer Task → kein Match → neuer `ask` | (d) |
| A5 | Untrusted Output läuft unter dem Grant (Trifecta-Wäsche) | bestehende §3.3-Regel bleibt **unangetastet**: `fromUntrusted`-Egress wird hart zu `ask`, ein scoped-Grant klärt ihn **nie** vor | Regressions-Test der bestehenden Trifecta-Suite |
| A6 | `maxActions` überschritten | Zähler pro Grant; Überschreitung → nächste Aktion `ask` + Warn-Signal | Zähl-Test |
| A7 | Kein Wildcard/leerer `pathPrefix` | Grant mit leerem/`*`-Präfix wird bei Ausstellung **abgelehnt** (kein Wildcard-Default) | Konstruktions-Test |

**Kanonische Härtung:** A1/A2 sind der Kern — die einzige sichere Pfad-Prüfung
ist Vergleich **nach** `fs.realpath` (bzw. `realpathSync`), nie String-Präfix auf
dem rohen `target`. **Basis-Ebene gelandet** (2026-07-06): `safeResolve`
(`fs-exec.ts`) kanonisiert jetzt das **Ziel** (realpath des existierenden
Präfixes) und weist einen Symlink ab, der aus der Root herauszeigt — der A2-Escape
ist damit im shipped fs-write-Pfad geschlossen (Tests: fs-write-broker.test.ts),
während eine In-Projekt-Symlink-Expansion erhalten bleibt. Der Scoped-Grant baut
darauf den `pathPrefix`-Vergleich (feiner als die Root-Boundary) auf. **Residual
Q3 (TOCTOU):** ein NACH der Prüfung getauschter Leaf-Symlink ist noch offen —
`openat`/`O_NOFOLLOW` wurde bewusst zurückgestellt, weil es auch legitimes
Editieren einer In-Projekt-symlinkten Datei blockieren würde; eigener Slice.

## 5. Gate-pro-Aktion-Matrix

| Aktion | Ohne Scoped-Grant | Mit passendem aktivem Scoped-Grant |
|---|---|---|
| `file-write` unter `pathPrefix`, trusted | `ask` (fail-closed) | **allow** (audited, unter Grant sichtbar) |
| `file-write` außerhalb `pathPrefix` | `ask`/`deny` | `deny` (Scope-Verletzung) |
| `file-write`, `fromUntrusted` | **`ask`** (hart) | **`ask`** (hart — Grant klärt nie vor) |
| `shell` matcht `commandPattern`, trusted | `ask` | **allow** |
| `secret-read` / `external-write` / `network` / `db-write` | Einzel-Gate | **Einzel-Gate** (nicht scoped-fähig) |

## 6. Interaktion mit der bestehenden Grant-Achse

- Keine neue `GrantAxis` — der task-gebundene Grant IST ein `scoped`-Grant mit
  strukturiertem Scope + Task-Lebensdauer. `once/session/deny` unverändert.
- `session` bleibt „für diese Session" (überlebt Task-Wechsel, stirbt mit der
  Session); der neue Grant ist enger (**Task**-Lebensdauer) — bewusst der
  konservativere Default für Bulk-Runs.
- `deny` bleibt sticky und schlägt jeden Grant.
- Der `#grants`-Key erweitert sich effektiv um `taskId` (via serialisiertem
  Scope) — bestehende Nicht-Task-Grants unverändert.

## 7. Anzeige + Widerruf (Konsument der P0-Matrix)

- Jeder `authorize`/`execute` unter dem Grant schreibt wie bisher einen
  `AuditEntry` (kein Wert, nur `credentialRef`-Name) → erscheint in `BrokerTicker`.
- Zusätzlich: eine **Grant-Zeile** (Task · Scope · Aktions-Zähler · Widerruf-
  Button) als read-only Projektion — reine UI, kein neues Sidecar-Primitiv nötig
  für die Anzeige selbst.
- Widerruf entfernt den Grant aus `#grants` → nächste Aktion `ask`.

## 8. Offene Fragen an das Review (Matze + Council)

- **Q1** — Ist die Task-Lebensdauer der richtige Default, oder soll ein Grant
  optional die Session überleben (Risiko vs. Bequemlichkeit)?
- **Q2** — `maxActions` verpflichtend oder optional? Ein hartes Limit ist
  defense-in-depth, aber nervt bei legitimen Groß-Läufen.
- **Q3** — TOCTOU: reicht realpath-vor-Schreiben, oder braucht es ein
  `openat`/`O_NOFOLLOW`-Äquivalent am Execution-Layer gegen Symlink-Swap im
  Zeitfenster?
- **Q4** — Soll `shell` überhaupt scoped-fähig sein, oder ist das zu breit und
  bleibt Einzel-Gate (nur `file-write` scoped)?
- **Q5** — Bulk-Run-Vorschau: welche Granularität der Muster-Abdeckung ist
  ehrlich genug, dass der Mensch versteht, was er freigibt, ohne Alarm-Müdigkeit?

## 9. Akzeptanzkriterien (werden Runbook bei Gate-Pass)

- Adversarial-Suite A1–A7 grün, enumeriert (nicht nur Kategorien).
- Bestehende Lethal-Trifecta-Suite bleibt grün (keine Regression von §3.3).
- Ein Scoped-Grant ist in der P0-Matrix sichtbar + widerrufbar.
- Manuelle Real-Abnahme (P1 Z. 238): ein echter Agent-Lauf mit ≥50 Schreib-
  zugriffen unter genau **einem** Prompt, sauberes Audit — **nach** Gate-Pass,
  auf Matzes Maschine.

## Council Pre-Review (2026-07-06)

Drei adversariale Reviewer, je eine Angriffs-Linse, gegen diesen Entwurf **und**
den echten `policy-engine.ts`/`capability-broker.ts`-Code. Verdikte:

| Linse | Verdict |
|---|---|
| Pfad / Symlink / TOCTOU | **FAIL** (7 Holes) |
| Lethal-Trifecta / Untrusted-Egress-Laundering | **CONDITIONAL** (1 latenter Code-Bug + 3) |
| Task-Lifecycle / Grant-Persistenz / Cross-Task-Leak | **FAIL** (Task-Bindung 100% aspirational) |

### Sofort gefixt in dieser Runde (latenter Bug im shipped Code)

- **HOLE-1 (Trifecta-Linse):** `shell` fehlte in `EGRESS_KINDS`
  (`policy-engine.ts:37`) → eine `fromUntrusted`-`shell`-Anfrage übersprang das
  Trifecta-Hard-Gate und wurde von einer harmlosen Allowlist-Regel
  (`git status* → allow`, `default-grants.ts:26`) **auto-allowed**. Shell ist
  uneingeschränkt egress-fähig (`git difftool`, `git log --ext-diff`/`--output=`,
  Pager/Alias). **Gefixt:** `shell` zu `EGRESS_KINDS` hinzugefügt + 2 Regressions-
  Tests (`broker.test.ts` MUST-NOT 4: untrusted shell → `ask`, keine Persistenz).
  Unabhängig vom Scoped-Grant-Feature — reiner Bugfix des Gates.
- **HOLE-1 (Pfad-Linse) — fs-write Symlink-Escape:** `safeResolve` kanonisierte
  nur die Root, `writeFileSync` folgte Symlinks → ein Symlink IN der Root, der
  nach außen zeigt (`src/link → /etc/...`), verließ die Workspace-Sandbox — heute
  shipbar. **Gefixt:** `safeResolve` (`fs-exec.ts`) kanonisiert jetzt das Ziel
  (realpath des existierenden Präfixes) + Boundary-Re-Check; nach-außen-Symlink →
  `deny`, In-Projekt-Symlink weiterhin erlaubt. 2 Tests (fs-write-broker.test.ts).
  Reiner Containment-Bugfix. **Residual:** Leaf-TOCTOU (Blocker 2).
- **HOLE-4 (Trifecta-Linse) — Key-Kollision:** `grantKey`/`consumableKey`
  (`policy-engine.ts`) bauten Keys per naivem `:`-Join → ein `:`-haltiges Target
  (`network` `https://h:443/x`, Windows-Pfad) konnte zwei logisch verschiedene
  Requests auf denselben Key kollidieren und deren Grants cross-clearen. **Gefixt:**
  beide Keys nutzen jetzt `JSON.stringify([...])` (derselbe injektive Idiom wie
  `requestFingerprint`) + Regressions-Test (broker.test.ts: `(x, "y:z")` vs
  `("x:y", z)` clearen sich nicht mehr). Reiner Isolations-Bugfix; schließt A9.

### Blocker fürs Gate (müssen ins Design + Code, bevor Bau)

1. **Scope wird auf dem Write-Pfad nie an den Broker übergeben** (HOLE-7 Pfad-
   Linse): `fs-write-broker.ts:83` ruft `authorize` **ohne** `scope`; `decide`
   vergleicht `request.target` **nie** gegen einen `pathPrefix` — ein
   persistierter `scoped`-Grant ist heute ein **Blanket-`kind:scope`-Allow**
   (`policy-engine.ts:148`), nicht das im Entwurf beschriebene Pattern-Match. Die
   zentrale Invariante („Ziel unter pathPrefix") ist unverdrahtet. → `decide`
   muss den strukturierten Scope gegen `target`/`command` prüfen; `fs-write-broker`
   muss den Scope durchreichen.
2. **~~`safeResolve` folgt Symlinks~~ (Basis GEFIXT 2026-07-06; TOCTOU-Residual
   offen):** die nicht-racy Variante ist geschlossen — `safeResolve` kanonisiert
   jetzt das Ziel (siehe § Council Pre-Review „Sofort gefixt"). **Offen:** ein
   NACH der Prüfung getauschter Leaf-Symlink (TOCTOU Q3/HOLE-2) → braucht
   `openat`/`O_NOFOLLOW` am Leaf, das aber legitimes Editieren einer In-Projekt-
   symlinkten Datei blockiert — eigener Slice, bewusst zurückgestellt.
3. **Task-Bindung ist 100% aspirational** (H1 Lifecycle): kein `taskId`/`revoke`/
   `expire` irgendwo im Code; `#grants` wächst nur, stirbt erst mit dem Prozess.
   „Task-Ende = Grant-Ende" und A4 sind unimplementiert. → `taskId` als
   **strukturiertes Key-Feld** (NICHT in den Scope-String serialisiert — sonst
   Kollision, H2), plus `revoke(taskId)`-Methode.
4. **Revocation-Race über zwei Grant-Maps** (H3 Lifecycle): Widerruf entfernt nur
   den Policy-Engine-Grant; ein bereits gemünzter `ExecutionGrant`
   (`capability-broker.ts` eigene Map) feuert nach dem Widerruf noch. → Revoke
   muss **beide** Maps per `taskId` sweepen; `execute` re-checkt Task-Liveness.
5. **`maxActions` ist verpflichtend, nicht optional** (H4 Lifecycle + HOLE-3
   Trifecta): kein Zähler-Storage heute (`#grants` ist `Map<string, GrantAxis>`);
   und der Scoped-Grant verstärkt eine `fromUntrusted`-Fehlklassifikation von 1
   auf N. → Zähler co-located mit dem Grant, Cap verpflichtend (Q2 = mandatory).
6. **`shell` bleibt NICHT scoped-fähig** (HOLE-1 Trifecta, Q4 = nein): nur
   `file-write` wird scoped; `shell`/`secret-read`/`external-write`/`network`/
   `db-write` bleiben Einzel-Gate.
7. **~~Strukturierte/escapte Grant-Keys~~ (GEFIXT 2026-07-06):** `grantKey`/
   `consumableKey` nutzen jetzt `JSON.stringify([...])` statt `:`-Join — keine
   Kollision mehr durch `:`-haltige Targets. Siehe § Council Pre-Review „Sofort
   gefixt". (Bleibt relevant fürs Scoped-Grant-Design nur, falls neue Key-
   Komponenten dazukommen — dann denselben Idiom nutzen.)
8. **Prefix-Boundary + macOS-Normalisierung** (HOLE-3/5 Pfad): `matches()` ist
   nacktes `startsWith` (`/srcX` matcht `/src`); APFS ist case-insensitive +
   NFC/NFD-normalisierend. → boundary-anchored Vergleich (`prefix + sep`) auf
   NFC-normalisierten, case-gefalteten realpath'd Pfaden; besser Inode-Vergleich.
9. **Hardlinks** (HOLE-6 Pfad, LOW-MED): realpath löst Hardlinks nicht auf; ein
   Hardlink `src/h → /etc/hosts` überlebt jede Symlink-Prüfung. → write-to-temp +
   `rename`, oder `nlink === 1`-Check.

### Neue Abuse-Cases (in die §4-Tabelle + §9-Suite aufzunehmen)

- **A8 — Mis-Classification-Amplification:** ein Provider setzt `fromUntrusted`
  fälschlich nicht; ein Scoped-Grant macht aus 1 verpasstem Gate N Auto-Allows.
  Mitigation: `maxActions` verpflichtend (Blocker 5) + Klassifikations-Contract
  am Provider-Rand pinnen.
- **A9 — Key-Collision:** `:`-haltiges Target kollidiert Grant-/Consumable-Keys
  (Blocker 7).

### Was der Entwurf richtig hatte (Council-Konsens)

Die **Reihenfolge** in `decide` ist korrekt (Trifecta-Hard-Gate steht
unbedingt vor jedem Grant-Allow); der `deny`-sticky + no-forever + fail-closed
sind real und test-gepinnt; der Ausschluss der gefährlichsten Egress-Kinds und
das Nicht-Antasten der §3.3-Regel sind die richtigen konservativen Schnitte;
realpath-nach-Kanonisierung ist das konzeptionell richtige A1/A2-Mittel — es ist
nur nicht gebaut. **Kein Cross-Project-Leak** gefunden (Caveat: `projectKey`
default `"default"` darf nie für zwei echte Projekte gelten).

## v2 — Blocker-Auflösung (2026-07-06, post-Council)

Jeder der 9 v1-Blocker wird hier konkret + code-geerdet aufgelöst. Drei waren
Shipped-Code-Bugs und sind bereits gefixt (PRs #31–#33); die übrigen sechs sind
Design-Entscheidungen, die die **Bau**-Spezifikation festlegen.

### Bereits gefixt (Shipped-Code, unabhängig vom Feature)
- **B-shell / B2-keys / B-symlink:** `shell` in `EGRESS_KINDS` (#31);
  `safeResolve` kanonisiert das Ziel (#32); Grant-Keys als `JSON.stringify`-Tupel
  (#33). Die Basis-Ebene ist damit gehärtet, bevor das Feature darauf aufsetzt.

### Design-Auflösungen (verbindliche Bau-Spezifikation)

1. **Scope wird durchgereicht + in `decide` erzwungen** (v1-Blocker 1, HOLE-7).
   `CapabilityScope` wird von einem opaken String zu einer strukturierten,
   **typisierten** Form (serialisiert weiterhin injektiv via JSON, siehe #33):
   `{ taskId, kind, pathPrefix, commandPattern?, maxActions }`. `fs-write-broker`
   reicht den aktiven Scope an `authorize`/`decide`. Der persistierte-`scoped`-
   Zweig in `decide` gibt **nicht** mehr blanket `allow`, sondern ruft
   `scopeMatches(grant, request)`: `request.target` (realpath-kanonisiert, siehe
   #32-Helper) muss **unter** `grant.pathPrefix` liegen (boundary-anchored,
   `prefix + sep`), sonst `deny`. Kein Match → fällt auf `ask` (fail-closed).
2. **Task-Bindung als typisiertes Feld + Live-Task-Registry** (v1-Blocker 3, H1/H2).
   `taskId` ist ein **First-Class-Feld** des Grant-Records, **nicht** in einen
   String serialisiert (verhindert die H2-Kollision). Neue Engine-Methode
   `endTask(taskId)` löscht alle Grants dieses Tasks; der Broker hält ein
   `#liveTasks: Set<taskId>`, und `decide` verweigert ein `scoped`-Match, dessen
   `taskId` nicht in `#liveTasks` ist (deckt A4: neuer Task, gleicher Scope →
   `ask`). Verdrahtet an alle vier Task-Ende-Bedingungen (fertig · Grant-Ablauf ·
   manueller Stopp · Idle) — geteilt mit dem Headless-Lifecycle (dort GAP-6).
3. **Revoke sweept beide Grant-Maps** (v1-Blocker 4, H3). `revoke(taskId)` +
   `endTask(taskId)` entfernen den Policy-Engine-Grant **und** invalidieren alle
   offenen `ExecutionGrant`s dieses Tasks in der Broker-Map; `execute` re-checkt
   `#liveTasks`-Zugehörigkeit vor dem Lauf (schließt das authorize→execute-Fenster).
4. **`maxActions` verpflichtend** (v1-Blocker 5, H4/A8). Jeder Scoped-Grant trägt
   einen Pflicht-Zähler (co-located im Grant-Record, der Value-Typ der Map wird
   `{ axis, taskId, pathPrefix, remaining }`), in `decide`/`execute` dekrementiert;
   `remaining === 0` → nächste Aktion `ask`. Bounded eine `fromUntrusted`-
   Fehlklassifikation (A8) von N auf den Cap. In-memory → Restart setzt nicht
   heimlich zurück (der Grant ist weg, nicht der Zähler-verwaiste Grant).
5. **`shell` bleibt NICHT scoped-fähig** (v1-Blocker 6, HOLE-1 Trifecta / Q4=nein).
   Nur `file-write` ist scoped. `shell`/`secret-read`/`external-write`/`network`/
   `db-write` bleiben Einzel-Gate. Ein Scoped-Grant für `shell` ist bei Ausstellung
   ein Fehler.
6. **Boundary-anchored + macOS-normalisierter Pfadvergleich** (v1-Blocker 8,
   HOLE-3/5). `scopeMatches` vergleicht NFC-normalisierte, auf case-insensitiven
   FS case-gefaltete realpath'd Pfade mit `target === prefix || target.startsWith(
   prefix + sep)` — nie nacktes `startsWith`. (Der bestehende `matches()` für
   Command-Allowlist bleibt unverändert; das ist ein separater Pfad.)
7. **Hardlink-Behandlung** (v1-Blocker 9, HOLE-6, LOW). `file-write` schreibt
   write-to-temp-in-dir + atomic `rename`; der Grant-Write prüft vorher
   `lstat(target).nlink === 1` und verweigert einen Multi-Link-Ziel (ein Hardlink
   auf `/etc/hosts` würde sonst in-place mutiert). Dokumentiert als LOW-Residual,
   falls `nlink`-Prüfung als zu streng befunden wird.

### Residual (bewusst offen, nicht Bau-blockierend)
- **Leaf-TOCTOU (Q3):** ein nach `scopeMatches` getauschter Leaf-Symlink. `openat`/
  `O_NOFOLLOW` zurückgestellt (bräche legitimes In-Projekt-Symlink-Editieren);
  der #32-Realpath-Check schließt die nicht-racy Variante. Eigener späterer Slice.

### Aktualisierte Abuse-Cases (v2)
A1 traversal · A2 out-of-root-symlink (#32) · A3 restart-loss (in-memory) ·
A4 cross-task (Live-Task-Registry) · A5 trifecta-untouched · A6 maxActions ·
A7 no-wildcard · **A8 mis-classification → maxActions-bounded** · **A9 key-collision
(#33)** — alle mit enumeriertem Test in der §9-Suite (Bau-Akzeptanz).

## v2 Re-Review (2026-07-06)

Zwei adversariale Linsen gegen die v2-Auflösung + echten Code. **Beide CONDITIONAL**
(v1 war 2× FAIL) — **kein Escape-to-arbitrary-write mehr gefunden; die A1/A2-Root-
Boundary hält bestätigt** (Path-Linse verifizierte `realCanonical` inkl. des
„nicht-existentes Ziel mit symlinktem Parent"-Falls). Die verbleibenden Punkte sind
**Wiring-Specs**, die v2.1 unten festschreibt, bevor gebaut wird.

| Linse | Verdict | Kern |
|---|---|---|
| Enforcement / Lifecycle | CONDITIONAL | 2 FAIL-grade Wiring-Lücken (canonical-target, taskId-Durchreichung) |
| Path-Containment | CONDITIONAL | Res 7 (Hardlink) inkohärent; Case-Fold aspirational |

### v2.1 — verbindliche Wiring-Specs (schließen die CONDITIONAL-Punkte)

1. **Canonical-Target-Verdrahtung (Enforcement FAIL-1).** Heute übergibt
   `fs-write-broker.ts:83` `authorize` einen **relativen** `target` (`"src/foo.ts"`);
   die Policy-Engine kennt die Repo-Root nicht → kann nicht gegen einen absoluten
   `pathPrefix` vergleichen. **Fix:** `fs-write-broker` kanonisiert **vor**
   `authorize` (`safeResolve` gibt künftig den `canonical` statt `abs` zurück, ODER
   der Broker reicht `root` + kanonisiert) und übergibt den **absoluten,
   realpath'd** Target an `decide`. `scopeMatches` vergleicht absolut gegen absolut.
2. **Ordering-Invariante festgeschrieben (Enforcement FAIL-1).** `scopeMatches`
   läuft **ausschließlich** im persistierten-`scoped`-Zweig von `decide`, **strikt
   nach** dem untrusted-egress-Hard-Gate (`policy-engine.ts:146`). Nie als früher
   Zweig, nie das untrusted-Gate umschließend. (Sonst HOLE-1-Laundering zurück.)
3. **`taskId` durchreichen — Request + ExecutionGrant + Index (Enforcement FAIL-2).**
   `CapabilityRequest` bekommt ein `taskId`-Feld; der `ExecutionGrant` (bzw. der
   Broker-`#grants`-Value) trägt die ausstellende `taskId`; ein `taskId → Set<grantId>`
   -Index ersetzt das reine `id → fingerprint`. `decide` matcht `grant.taskId ===
   request.taskId` (NICHT nur `∈ #liveTasks` — sonst reitet ein zweiter lebender
   Task den Grant des ersten). `execute` re-checkt `#liveTasks` **und** `endTask`
   sweept den Broker-Map-Index per `taskId` (schließt das authorize→execute-Fenster).
4. **`#grants`-Value-Typ + resolve-Seite + session-Diskriminator (Enforcement PASS-note).**
   Value wird `{ axis, taskId, pathPrefix, remaining }`. `resolve` schreibt das
   Objekt (nicht die nackte Achse); Sticky-`deny` wird `persisted?.axis === "deny"`;
   `scopeMatches`/Dekrement laufen **nur** für `axis === "scoped"`, `session` bleibt
   Blanket-Allow (kein `scopeMatches` auf einem `session`-Grant ohne `pathPrefix`).
5. **`shell`-Reject bei Ausstellung + defensiver decide-Check (Enforcement PASS-note).**
   Scope mit `kind !== "file-write"` wird bei der Grant-Erstellung abgelehnt;
   `decide` refust defensiv zusätzlich einen scoped-Grant, dessen `kind` nicht zum
   Request passt.
6. **Res 7 (Hardlink) neu geschnitten (Path GAP-2/3/4).** Ersetzt das inkohärente
   „`nlink===1` + temp+rename": der Grant-Write nutzt **write-to-temp-im-Zielordner
   + atomic `rename`** — das **ersetzt** das Ziel-Inode (neutralisiert den Hardlink
   by construction, statt es in-place zu mutieren; `nlink` ist das falsche Primitiv,
   es ist `1` für `/etc/hosts`). Der **Rename-Zielordner wird unmittelbar vor dem
   Rename neu `realCanonical`'d** (schließt Parent-Symlink-Swap). **Downstream:**
   `renameSync` ist im `broker-chokepoint.test.ts:188`-Bann → `fs-write-exec.ts` muss
   in die `fs-write`-Allowlist; UND dies ändert das **geteilte** Human-Save-Primitiv
   (`writeTextWrite`, in-place) → entweder ein **separates** Grant-Write-Primitiv
   forken (Human-Save bleibt in-place) oder den Inode-Churn für alle Saves bewusst
   dokumentieren. v2.1 wählt: **forken** (kleinster Blast-Radius).
7. **Case-Fold real machen + Prefix-Kanonisierung bei Ausstellung (Path GAP-1 + Minor).**
   `scopeMatches` `.normalize("NFC")` + case-fold **beide** Operanden auf
   case-insensitivem FS (`realCanonical` foldet NICHT selbst — der nicht-existente
   Tail behält die Anfrage-Casing). `pathPrefix` wird **bei Grant-Ausstellung**
   `realCanonical`'d + boundary-validiert (nicht nur der Target zur Check-Zeit) +
   leerer/`*`-Prefix hart abgelehnt (belt-and-suspenders zu A7).

### Residual (bewusst offen)
- Leaf-TOCTOU (Q3) — neu bewertet gegen das temp+rename aus Spec 6: der Residual-
  Text wird beim Bau gegen die finale Write-Strategie neu abgeleitet (temp+rename
  verlängert das Fenster nicht, wenn der Zielordner unmittelbar vor Rename
  re-kanonisiert wird — Spec 6). `O_NOFOLLOW` bleibt zurückgestellt.
- Windows-Mixed-Separator — out-of-scope für die macOS/POSIX-Zielplattform, als
  Windows-Deferral notiert.

### v2.2 — Final-Gate-Fixes (3. Runde 2026-07-06, im Bau angewandt)

Die 3. Runde (safe-to-build-Mandat) ergab **CONDITIONAL** mit 3 Spec-Text-Fixes;
der Reviewer zertifiziert „amend per these and this is buildable". Angewandt:

- **F1 — `target` nicht überladen:** neues **`CapabilityRequest.canonicalTarget?`**
  (absoluter realpath), von `fs-write-broker` befüllt (hat `root` in Scope);
  `scopeMatches` vergleicht `canonicalTarget` gegen den absoluten `pathPrefix`.
  `request.target` (Audit-Label + Allowlist-Input) **und** `safeResolve`-Return
  bleiben unverändert (kein Audit-Drift, kein Bruch des geteilten Primitivs).
- **F2 — taskId ans Fingerprint binden + Ownership klären:** `taskId` kommt in
  `requestFingerprint` (bindet einen `ExecutionGrant` an den ausstellenden Task —
  schließt den Cross-Task-Ride allein); Broker-`#grants`-Value → `{ fingerprint,
  taskId }` + `taskId → Set<grantId>`-Index; **`#liveTasks` lebt auf dem Broker**
  und wird als Parameter in `policy.decide` gereicht (die Engine greift nie in
  Broker-State). Erster Build: **manuelles `revoke(taskId)` + Prozess-Tod**; die
  vier Auto-Sweeps (fertig/idle/timeout/stopp) sind getrackter Follow-up (Headless
  GAP-6), mit einem Test der einen stale Grant abweist.
- **F3 — Value als discriminated union + Primitiv-Ort:** `#grants`-Value =
  `{axis:"deny"} | {axis:"session"} | {axis:"scoped"; taskId; pathPrefix; remaining}`
  (alle `set`/`get`-Sites aufgezählt). Das forked temp+rename-Grant-Write-Primitiv
  lebt **in `fs-write-exec.ts`** (schon in der Chokepoint-`fs-write`-Allowlist —
  die v2.1-Behauptung „muss hinzugefügt werden" war faktisch falsch).

**Build-Reihenfolge (Reviewer-TDD, риск-first):** (1) taskId→Fingerprint +
Cross-Task-Ride-Test; (2) canonical-Target-Seam; (3) `scopeMatches`
(boundary+NFC); (4) union-`#grants` + `maxActions`; (5) `revoke`/`#liveTasks` +
Revoke-Race-Test; (6) forked temp+rename. Vorab-Invariante gepinnt: untrusted
file-write bleibt `ask` **auch bei aktivem passendem scoped-Grant** (HOLE-1-Lock).

**Bau-Fortschritt:** ✅ Schritt 1 (taskId→Fingerprint, PR #34). ✅ Enforcement-Kern
(Schritte 3+4): `PersistedGrant`-discriminated-union in `policy-engine.ts`,
`scopeMatches` (task-gebunden + canonicalTarget unter `pathPrefix`,
boundary-anchored + NFC/case-fold, **strikt nach** dem untrusted-Gate),
`maxActions`-Dekrement, Issuance-Rejects (non-file-write / fehlende taskId /
leerer-relativer Prefix / non-positive Budget) + Adversarial-Suite A1/A2/A4/A5/A6/A7
(inkl. Ordering-Pin). Engine bleibt I/O-frei (Kanonisierung caller-seitig). **Offen:**
Schritt 2 (fs-write-broker füllt `canonicalTarget` real — heute inert, da keine UI
scoped-Grants erzeugt), UI (Grant in Matrix + Widerruf, 229 Bulk-Run).
✅ Schritt 2 (`canonicalizeTarget` in fs-exec — absoluter realpath'd Target für
den scopeMatches-Vergleich) + ✅ Schritt 6 (`writeTextGrantWrite` in fs-write-exec
— forked temp+rename-Primitiv: neutralisiert Hardlinks by-inode-replace + schließt
Parent-Symlink-Swap via dest-dir-Re-Kanonisierung; Human-Save-`writeTextWrite`
bleibt in-place). Beide getestet (Hardlink-Neutralisierung, Symlink-Escape-Reject,
canonicalizeTarget-absolut/escape). Exported Bausteine — der **Agent-Write-Pfad**
konsumiert sie (füllt `taskId`+`canonicalTarget`, nutzt `writeTextGrantWrite`) bei
der UI-Integration.
✅ Bulk-Run-UX-Kern (Item 229): **UX-Entscheidung getroffen** (Matze) — toggleable
**Muster-Abdeckungs-Vorschau**, Default an; off → Once/Session/Deny, an → volle
Vorschau. Gebaut contract-mock-first: `PendingWriteIntent`/`GrantPreview`-Contract
+ reine `buildGrantPreview`/`suggestPathPrefix`/`isUnderPrefix` (boundary-anchored,
NFC — spiegelt die Broker-`scopeMatches`-Regel, damit die Vorschau nie mehr
verspricht als der Grant klärt) + deterministischer Mock + 9 Unit-Tests. ✅ Permission-Prompt-Visual + Setting: `PermissionPrompt` um `grantPreview`/
`onGrantScoped` erweitert (rendert die Coverage-Vorschau ✓covered · ⚠out-of-scope +
einen „Grant N writes under <prefix>/"-Button — **additiv**, ohne Preview
byte-identisch → Goldens unberührt, bestätigt); `scopedGrantsEnabled`-Setting
(Default an, persistiert) + AgentSettings-Toggle (Permissions-Sektion, off →
Once/Session/Deny); Story-Variante + 4 Komponenten-Tests. **Offen (die Aktivierung):**
der Agent-Write-Pfad, der bei aktivem Setting reale `PendingWriteIntent`s speist
(Agent-Lookahead — gegated auf real-runtime) und `writeTextGrantWrite` nutzt; erst
dann ist die Vorschau in einem echten Prompt sichtbar (dann Golden-Update + 238-Abnahme).
✅ Schritt 5 (Revoke): `PolicyEngine.revokeTask` + `Broker.revokeTask` — droppt die
scoped-Grants eines Tasks UND invalidiert offene `ExecutionGrant`s über einen
`taskId→grantId`-Index (schließt das authorize→execute-Fenster, v1-H3-Race);
Tests: Revoke-droppt-Grant, session-unberührt, idempotent, Broker-Revoke-Race,
Fremdtask-unberührt. **Offen** (Headless-Follow-up): `#liveTasks`-Liveness in
`decide` + Auto-Sweep an Task-Ende + Multi-Task-Concurrent-Index.

## 10. Referenzen

- `app/sidecar/broker/policy-engine.ts` — `GrantPolicyEngine` (Ist-Stand).
- `app/src/contracts/broker.ts` — `GrantAxis`, `CapabilityScope`, `AllowlistRule`,
  `AuditEntry`, `PermissionDecision`.
- `app/src/shell/matrix/BrokerTicker.tsx` — P0-Anzeige des Audit-Stroms.
- `agents/design-gates/g-prod-readonly-enforcement.md`,
  `g-browser-threat-model.md` — Schwester-Gate-Artefakte (gleiche Konvention).
- road-to-agent-matrix-and-ambient.md Phase 1 (Z. 214–242); löst
  road-to-actually-works P2 (Z. 125) ein.
