# G-PROD-RO — Prod-read-only Enforcement-Design (Design-Gate, road-to-real-breadth P1)

*Design-Gate-Artefakt (Overview §6a). Muss vorliegen + zweiten unabhängigen
Review (Council) bestehen, BEVOR der Schreib-/Enforcement-Kern der Datasource-
Phase implementiert wird. Lesender Betrieb (Connections/Query/Schema) ist nicht
gated. Wird Acceptance-as-Runbook.*

> **GATE-STATUS: 🟡 PASS-WITH-CHANGES** (Council 2026-06-26, anthropic
> claude-sonnet-4-5 + openai gpt-4o, api, $0.13, 2 Runden — beide). Implementieren
> erst, wenn der **Credential-Swap** (§7.1) + die Pflicht-Fixes (§7) im Design
> verankert sind. Der client-seitige read-only-Connection-Modus des Erstentwurfs
> ist **umgehbar** und wurde verworfen.

## 1. Die Invariante (nicht verhandelbar)

```
Prod-Datasources sind read-only für ALLE Principals (Mensch wie Agent).
Die "dauerhaft erlauben"-Option ist STRUKTURELL unkonstruierbar.
Einziger Ausstieg: per-Befehl-einmalig, danach automatisch wieder read-only.
```

`Datasource.readonly` ist **abgeleitet** aus `env === "production"`, nicht
settable (B-pre-Fix existiert im Contract). Welche DB `production` ist:
**human-confirmed**, nie aus Connection-String inferiert.

## 2. Durchsetzung MUSS am Treiber-Layer sitzen (nicht UI)

Der bestehende Broker erzwingt für `db-write` gegen eine `production`-Datasource
bereits einen single-shot `WriteEscape` (capability-broker.ts: matched command +
single-use, kein „remember") — getestet in der Invarianten-Suite. **Aber**: das
gilt nur für Writes, die *durch den Broker* gehen. Der Enforcement-Kern muss
sicherstellen, dass es **keinen anderen Schreibpfad am Treiber** gibt:

- Der DB-Treiber wird mit einem **read-only-Connection-Modus** geöffnet, wenn die
  Datasource `production` ist (z. B. Postgres `default_transaction_read_only=on` /
  MySQL read-only session / Redis `READONLY`-Replica-Verbindung) — Schreibversuche
  scheitern **am Server**, nicht nur an einer UI-Prüfung.
- Der Einmal-Escape hebt den read-only-Modus **für genau eine Anweisung** auf
  (eigene Connection/Transaktion, danach verworfen) — kein session-weites Toggle.
- Kein Code-Pfad konstruiert eine schreibbare Prod-Connection ohne den Broker-Escape.

## 3. Form des per-Befehl-Einmal-Escapes

- Bindet an **genau eine** Anweisung (command-match, wie der bestehende `WriteEscape`).
- Single-use, getrackt über opaque frozen `id` (kein mutables `consumed`-Flag → kein Replay).
- Nach Ausführung: Connection/Transaktion verworfen, Datasource sofort wieder read-only.
- Kein „für diese Session", kein „remember", keine Allowlist — strukturell nicht baubar.

## 4. Tenant-Fan-out-Write

- Lesender Fan-out über N gleich-strukturierte DBs: erlaubt.
- **Schreibender** Fan-out: nur mit **Per-Ausführung-Bestätigung pro Ziel**, broker-gegated, nie persistiert. Ein Fan-out-Write gegen eine `production`-DB im Set erbt G-PROD-RO (jede einzeln einmal-Escape).

## 5. Geforderte Negativ-Tests (adversarial, automatisiert — Pflicht vor „done")

1. `db-write` gegen Prod ohne Escape → scheitert **am Treiber** (read-only-Connection), nicht nur UI.
2. Escape für Anweisung X → Versuch, Anweisung Y darüber zu fahren → abgelehnt (command-mismatch).
3. Escape zweimal nutzen (Replay) → abgelehnt (single-use, frozen id).
4. Versuch, eine schreibbare Prod-Connection am Treiber zu öffnen ohne Broker → kein Code-Pfad existiert (struktureller Test: grep/Architektur-Assert wie broker-chokepoint).
5. `consumed`-Flag/Escape-Klon zurücksetzen → kein Effekt (Verbrauch über Registry, nicht Flag).

## 6. Offene Fragen für den Council

- Reicht der treiber-seitige read-only-Modus pro Engine (PG/MySQL/Redis), oder gibt es Engine-Eigenheiten, die ihn umgehen (z. B. Stored Procedures, `pg_*`-Funktionen, Redis-Scripting)?
- Ist „welche DB ist production" robust human-confirmed, oder gibt es einen Inferenz-Pfad (Connection-String-Heuristik), der versehentlich greift?
- Soll der Einmal-Escape ein Audit-Pflichtfeld (wer/was/wann) erzwingen, bevor er feuert?
- Fehlt ein Bypass-Vektor (Migrations-Runner, ORM-Bulk-Write, Admin-Tool-Pfad)?
- Wie verhält sich der Escape bei einer Anweisung mit Seiteneffekten über Trigger/Kaskaden (die Query-History-Undo-Grenze)?

## 7. Council-Review (2. unabhängiger Durchgang) — VERDIKT PASS-WITH-CHANGES

Council 2026-06-26 (anthropic claude-sonnet-4-5 + openai gpt-4o, api, 2 Runden,
$0.13). **Beide: PASS-WITH-CHANGES.** Host-Verdikt: alle Befunde valide → **accept**.
Der Erstentwurf-Ansatz „read-only-Connection-Modus per Treiber-Flag" ist
**client-seitig umgehbar** (Connection-Pool-Reuse, Race) — verworfen. Vor der
Implementierung des Schreib-/Enforcement-Kerns:

**FATAL (Redesign):**
1. **Credential-Swap statt Connection-Flag** — die Default-Connection nutzt einen
   **read-only DB-USER** (Server erzwingt, nicht der Client). Ein Schreib-Escape
   holt eine **Einmal-Write-Credential** vom Broker (eigene Connection, danach
   verworfen). Kein client-seitiges `setReadOnly` (umgehbar via Pool-Reuse).
   ```
   default:  pool.getConnection({ credential: READ_ONLY_USER })   // Server-enforced
   escape:   broker.getWriteConnection({ credential: WRITE_USER, query, maxRows }) → close()
   ```
2. **`SECURITY DEFINER`-Funktionen umgehen Connection-read-only** — `SELECT my_func()`
   kann Writes ausführen, wenn die Funktion einem Superuser gehört. **Fix:** Audit +
   `EXECUTE` auf write-haltige Funktionen entziehen; read-only-User hat nur `pg_read_all_data`.
3. **`COPY TO PROGRAM` = Server-seitiger Egress** (`COPY (SELECT…) TO PROGRAM 'curl …'`).
   **Fix:** read-only-User ohne `pg_execute_server_program`; explizit verbieten.

**HIGH (vor Code):**
4. **Cascade-Amplifikation:** ein einzeiliges `DELETE` mit `ON DELETE CASCADE` trifft N
   Zeilen. **Fix:** Escape deklariert `maxRows`; Broker zählt betroffene Zeilen in der
   Transaktion, **Rollback + Alert** bei Überschreitung.
5. **Prod-Label-Tampering:** Agent könnte „production"→„staging" relabeln. **Fix:**
   Config **signiert** (HMAC, server-seitiger Key), Label-Änderung = **Zwei-Mensch-Freigabe**,
   Label bei **jedem** Query verifiziert (nicht im Memory gecacht), Audit append-only/extern.
6. **Escape-Registry atomar:** Test-and-set gegen Race (`redis.set(id,'used',{NX:true})`
   oder `INSERT … ON CONFLICT DO NOTHING` + affected-rows-Check), nicht `has()`-dann-`add()`.
7. **Migrations:** eigener Escape-Typ `db-migrate` (nicht `db-write`), Migration-Runner ohne
   direkte Creds, content-hash-verifizierte/signierte Migrationsdatei; ORM-Bulk-Write-Pfad prüfen.
8. **`LISTEN/NOTIFY`** als Cross-Session-Covert-Channel → `pg_signal_backend` entziehen / Kanal-Allowlist.

**Akzeptanz des Gates:** öffnet, wenn §7.1 (Credential-Swap) im Design steht und
§7.2/§7.3 (Funktions-Audit, COPY-Block) + die Negativ-Tests (§5, erweitert um
SECURITY-DEFINER, COPY TO PROGRAM, Cascade-Limit, Label-Tamper) spezifiziert sind.
