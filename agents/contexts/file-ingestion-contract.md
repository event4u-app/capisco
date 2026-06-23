# File-Ingestion-Contract

Durable Design- + Threat-Contract für die Datei→Context-Ingestion des Composers
(`+`-Add, Drag&Drop) und das Code-Hunk-Revert. **Blockierende Phase 0 von
`road-to-composer-context-runtime`** und zugleich der von `security-sensitive-stop`
geforderte Threat-Pass, bevor die Broker-/Secret-/prod-Flächen berührt werden.

> Quelle: Council 2026-06-22 (claude-sonnet-4-5 + gpt-4o) — höchste-ROI-Vorarbeit,
> Sequencing-Blocker für UI **und** Tests. Invarianten: Overview §2 (Secrets nie in
> den LLM-Context; prod-Datasources read-only für alle), §2.3 (Ehrlichkeit über Grenzen).

## 1. Was ist eine „Datei" im Context-Modell

**Entscheidung: Pfad-Referenz + on-demand-Read durch das Backend** (nicht eager voller
Inhalt in den Payload). Ein Context-Eintrag ist `{ path, displayName, sourceTag }` —
**kein** Inhalts-Snapshot. Das Backend liest den Inhalt erst beim tatsächlichen Senden,
durch denselben autoritativen Lese-Pfad wie jede andere Datei.

- **Begründung:** spart Token (Grounding-These), und der Secret-/prod-Check passiert am
  Lese-Chokepoint, nicht an einer zweiten, divergierenden Snapshot-Kopie.
- **Konsequenz:** ein zwischen Ingestion und Read gelöschter/geänderter Pfad wird beim
  Read sauber als Fehler behandelt (Failure-Modes unten), nie als stale Snapshot gesendet.

## 2. Wer scannt — der eine Chokepoint

**Entscheidung: der Capability-Broker** ist der einzige Ort, der Secret-/prod-Status
entscheidet — **identisch** zum Datasource-Pfad. `+`-Add **und** Drag&Drop münden in
**denselben** `ingestFile(path)`-Pfad, der `broker.authorize(read, path)` aufruft. Es gibt
**keinen** zweiten Ingestions-Pfad (das ist die Kern-Attack-Surface — siehe Test 4).

## 3. Check | Wann | Wer

| Check | Wann | Wer | Bei Verstoß |
|---|---|---|---|
| Secret-Form (`sk-…`, `key=`, `.key`, `Authorization:`) | Ingestion **und** Read | Broker | Refusal-Chip, nie als Wert |
| prod-Datasource-Herkunft | Ingestion (Tag) + Read (re-check) | Broker | read-only-Referenz, nie roher Wert |
| Pfad existiert / lesbar | Read | Backend | Eintrag als „missing" markiert |
| Größe / Binär | Ingestion | Composer/Backend | abgelehnt mit Hinweis |
| Audit-Record | Ingestion **und** Read | `audit.record` | — (jeder Zugriff geloggt) |

## 4. Welche Metadaten reisen mit

Der Context-Eintrag trägt `sourceTag` (`local` | `prod:<name>` | `datasource:<name>`).
Das Tag wird **an der Ingestions-Grenze** gesetzt und beim Read **erneut** geprüft (nie
allein dem at-ingestion-Tag vertraut). Ein `prod:*`-Eintrag ist strukturell read-only.

## 5. Failure-Modes

- **Datei gelöscht zwischen Ingestion und Read** → Read-Fehler, Eintrag „missing", kein Send.
- **Datei geändert** → der frische Inhalt wird gelesen (Live-Referenz, kein stale Snapshot).
- **Symlink** → auf das Ziel aufgelöst, Ziel durchläuft denselben Broker-Check.
- **prod/Secret zwischengeschmuggelt** → Refusal auf **beiden** Pfaden (Test 4/5).

## 6. Revert (Code-Hunk)

Revert verwirft **nur** den Code-Hunk im Worktree, **nie** Seiteneffekte (§2.3). Läuft
git-autoritativ via `execFile` mit **argv-Array** (kein Shell, keine Interpolation —
Test 6). Disabled ohne Worktree, mit ehrlichem Hinweis. Audit-Record trägt die Aktion.

## 7. Abuse-Cases → Pflicht-Tests (Threat-Pass-Output)

| Abuse-Case | Gegenmaßnahme | Test |
|---|---|---|
| Drag&Drop umgeht den Secret-Scan, den `+`-Add hat | **ein** Ingestions-Pfad, ein Broker-Chokepoint | 4 (Ingestion-Refusal-Attack) |
| prod-File wird roh in den Context gelesen | prod-Tag at-ingestion + re-check at-read | 5 (prod-read-only-at-ingestion) |
| Pfad mit Shell-Metazeichen injiziert beim Revert | `execFile` argv-Array, kein Shell | 6 (Revert-argv-Isolation) |
| Revert behauptet Seiteneffekt-Undo | Label/Audit benennen die Grenze | 2 (Revert-Ehrlichkeit) |
| Secret-Wert landet im Payload | Pfad-Referenz + on-demand-Read durch den Broker-Pfad | 1 (Ingestion-Invariante) |

Diese fünf Abuse-Cases sind die `road-to-composer-context-runtime`-Pflicht-Tests 1, 2, 4,
5, 6. Erweiterung der Liste = Security-Entscheidung, nie autonom.
