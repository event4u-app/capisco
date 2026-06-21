---
status: ready
block: Backend
depends_on: [road-to-real-git, road-to-runnable-dev]
autonomy: "A (voll auto — gegen Temp-Repos, B1/B2-Muster)"
council: "3 Linsen 2026-06-21 (Architektur · Autonomie · Security) — Befunde unten verankert"
---

# Road to Local-Artifact-Hygiene — Capisco-Dateien aus dem Consumer-Git heraushalten

**Goal:** Capisco hinterlässt unweigerlich projekt-lokale Dateien im Consumer-Projekt
(User-Settings, Workspace-Layout, lokale Caches). Diese sollen **nicht im Git des Projekts
landen** — **ohne** die geteilte `.gitignore` des Teams anzufassen. Lösung:
`.git/info/exclude` (lokal, nie committet, nie geteilt).

> Referenz: `agents/tmp/feature-gitignore.txt` (Auflösung: ein Pfad + `.git/info/exclude`,
> nie die geteilte `.gitignore`).

> **Council-Einordnung (Autonomie):** Komplett **Klasse A** — die am saubersten
> auto-verifizierbare Roadmap des Bündels (Pendant zu real-git gegen Temp-Repos). Läuft
> reibungslos auto-grün; ideal **parallel zu design-sync-v1** (disjunkter Code: Sidecar-fs vs.
> React-Shell).

## Akzeptanz (harte Security-Kriterien aus der Security-Linse)

- **AK-G1 — broker-mediierter fs-Write:** Das Schreiben in `.git/info/exclude` ist ein
  **mutierender Filesystem-Write** und läuft durch den Broker-Chokepoint
  (`sidecar/test/broker-chokepoint.test.ts`-Invariante: kein Execution-Edge ohne `allow`).
  **Keine** allowlistete Read-Only-Operation. Default-Allowlist (B4): mutating → `ask`.
- **AK-G2 — Transparenz beim ersten Mal:** Erster Schreibvorgang pro Repo → sichtbare Notiz /
  einmalige Bestätigung (der Broker-`ask` *ist* die Bestätigung). Nie heimlich in `.git/`.
- **AK-G3 — idempotent, markierter Block, kein `.gitignore`-Touch:** Nur ein markierter Block
  (`# capisco — local, do not commit` … End-Marker), idempotent (zweiter Lauf = no-op);
  schreibt **ausschließlich** in `.git/info/exclude`, nie in versionierte Dateien.
- **AK-G4 — no-repo sicher:** Kein `.git` → still nichts tun, kein Fehler, kein Anlegen von
  `.git/`.
- Verifikation hermetisch gegen `git init`-Temp-Repos (B1/B2-Muster), maschinenunabhängig;
  Pfad-Kanonisierung beachten (macOS `/var`→`/private/var`, B2-Lektion).

## Phase 0 — Ein projekt-lokaler Pfad

- [ ] **Festlegung:** Alles Capisco-Projekt-Lokale unter **einem** Pfad (`.capisco/`), damit der
      Exclude-Eintrag **eine** Zeile bleibt statt einer wachsenden Liste verstreuter Muster.
- [ ] Bestehende projekt-lokale Schreibpfade dorthin konsolidieren; Test: Capisco-Writes landen
      unter `.capisco/`.
- [ ] **Decision-Gate (PO):** Persönlich-vs-geteilt-Grenze innerhalb `.capisco/` —
      `.capisco/local/` + `.capisco/cache/` → exclude; ein evtl. geteiltes `.capisco/project.toml`
      bleibt versioniert. Default: nur persönliche Unterpfade excludieren.

## Phase 1 — Idempotenter `.git/info/exclude`-Eintrag

- [ ] Beim ersten Öffnen/Schreiben: markierten Block in `.git/info/exclude` eintragen — **vorher
      prüfen**, ob er da ist (idempotent), nur Fehlendes ergänzen.
- [ ] Geht durch den Broker (AK-G1) → `ask` + sichtbare Erst-Notiz (AK-G2).
- [ ] Test gegen Temp-Repo: Block geschrieben; zweiter Lauf = no-op (Idempotenz-Assert);
      `.gitignore` unberührt.

## Phase 2 — Randfälle

- [ ] **No-Repo:** Temp-Dir ohne `git init` → still nichts tun, kein Throw (AK-G4).
- [ ] **`core.excludesFile`** des Nutzers respektieren: Temp-Repo mit gesetztem
      `core.excludesFile` → kein Doppel-Schaden, Fall bekannt statt angenommen.
