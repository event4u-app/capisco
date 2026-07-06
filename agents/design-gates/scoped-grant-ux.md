# Scoped-Grant-UX — Design + Threat-Model (Design-Gate, road-to-agent-matrix-and-ambient P1)

*Design-Gate-Artefakt. Dieses Dokument muss vorliegen + einen Design-Review
durch Matze (+ zweiten unabhängigen Council-Review) bestehen, BEVOR der Broker-
Bau-Schritt (P1 Z. 226 „`scoped`-Grants im Policy-Engine umsetzen") beginnt. Es
wird bei Bestehen zur Acceptance-as-Runbook der Adversarial-Testsuite (P1 Z. 232).*

> **GATE-STATUS: ⛔ FAIL** (Council-Pre-Review 2026-07-06, 3 adversariale Linsen
> gegen Entwurf + echten `policy-engine.ts`-Code — 2× FAIL, 1× CONDITIONAL). Das
> Gate hat seinen Zweck erfüllt: die Runde fand mehrere strukturelle Bypässe, die
> der Erstentwurf übersah — **darunter einen latenten Security-Bug im shipped
> Code** (untrusted `shell` umging das Trifecta-Gate; in dieser Runde gefixt,
> siehe § Council Pre-Review). **Kein `scoped`-Grant-Code, bis die in § Council
> Pre-Review gelisteten Blocker im Design adressiert + von Matze reviewed sind.**
> Fallback bei „nicht sicher umsetzbar": manuelle Session-Grants pro Datei +
> Human-in-Loop (hässlich, kein Blocker) — P2 bliebe dann blockiert.

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
dem rohen `target`. TOCTOU-Hinweis: Kanonisierung + Schreiben müssen am
Execution-Layer atomar genug sein, dass ein zwischenzeitlich getauschter Symlink
nicht durchrutscht — offene Frage Q3.

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

### Blocker fürs Gate (müssen ins Design + Code, bevor Bau)

1. **Scope wird auf dem Write-Pfad nie an den Broker übergeben** (HOLE-7 Pfad-
   Linse): `fs-write-broker.ts:83` ruft `authorize` **ohne** `scope`; `decide`
   vergleicht `request.target` **nie** gegen einen `pathPrefix` — ein
   persistierter `scoped`-Grant ist heute ein **Blanket-`kind:scope`-Allow**
   (`policy-engine.ts:148`), nicht das im Entwurf beschriebene Pattern-Match. Die
   zentrale Invariante („Ziel unter pathPrefix") ist unverdrahtet. → `decide`
   muss den strukturierten Scope gegen `target`/`command` prüfen; `fs-write-broker`
   muss den Scope durchreichen.
2. **`safeResolve` kanonisiert nur die Root, `writeFileSync` folgt Symlinks**
   (HOLE-1 Pfad-Linse): `fs-exec.ts:40` realpath't nur die Root, `fs-write-exec.ts:32`
   schreibt durch jeden Symlink → der A2-Escape (Symlink `src/x → /etc/...`) ist
   **heute shipbar**. → realpath des **Ziel-Präfixes** + `O_NOFOLLOW`/`openat` am
   Leaf (schließt auch TOCTOU Q3/HOLE-2).
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
7. **Strukturierte/escapte Grant-Keys** (HOLE-4 Trifecta): `grantKey`/`consumableKey`
   bauen Keys per naivem `:`-Join ohne Escaping → `:`-haltige Targets (URLs
   `https://h:443/x`, Windows-Pfade) kollidieren. → Tupel/JSON-Key statt String-Join.
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

## 10. Referenzen

- `app/sidecar/broker/policy-engine.ts` — `GrantPolicyEngine` (Ist-Stand).
- `app/src/contracts/broker.ts` — `GrantAxis`, `CapabilityScope`, `AllowlistRule`,
  `AuditEntry`, `PermissionDecision`.
- `app/src/shell/matrix/BrokerTicker.tsx` — P0-Anzeige des Audit-Stroms.
- `agents/design-gates/g-prod-readonly-enforcement.md`,
  `g-browser-threat-model.md` — Schwester-Gate-Artefakte (gleiche Konvention).
- road-to-agent-matrix-and-ambient.md Phase 1 (Z. 214–242); löst
  road-to-actually-works P2 (Z. 125) ein.
