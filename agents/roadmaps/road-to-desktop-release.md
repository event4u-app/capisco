---
status: ready
block: Desktop / Packaging
depends_on: [road-to-tauri-desktop-shell]
autonomy: "A (Build-Targets + Versioning + CI-Workflow) / C (Signing/Notarisierung = Zertifikate durch Matze) / Hard-Floor (Release-Tag/Publish = explizite Freigabe)"
---

# Road to Desktop-Release — verteilbare, signierte Capisco-Builds

**Goal:** Aus dem Tauri-Shell (`road-to-tauri-desktop-shell`) **installierbare Artefakte**
machen — reproduzierbarer `tauri build`, der den Sidecar mitbündelt, plus Versioning,
Code-Signing/Notarisierung und ein **tag-getriggerter CI-Release**, der die Artefakte an
ein GitHub-Release hängt. Optional Auto-Update.

> **Sicherheits-/Floor-Hinweis:** Release-Tag, Push und Publish sind **Hard-Floor** —
> nur mit expliziter Freigabe pro Lauf. Signing-Zertifikate/Keys liegen bei Matze
> (Secrets), nie im Repo; CI liest sie aus GitHub-Secrets.

## Decision-Gates (PO — Defaults gesetzt, Override jederzeit)

| Gate | Default-Vorschlag | Quelle |
|---|---|---|
| Ziel-Plattformen | **macOS zuerst** (`.dmg`/`.app`, Apple-Silicon + Intel), dann Windows (`.msi`/NSIS) + Linux (AppImage/deb) | Maintainer-Plattform |
| Sidecar-Packaging | **Single-Binary** (Node-SEA / `pkg` / Bun-compile) als Tauri-`externalBin` (kein Host-node beim Endnutzer); Entscheidung im Detail in Phase 0 | tauri sidecar |
| Code-Signing | macOS **Developer-ID + Notarisierung**; Windows **Authenticode** — beides Cert-gated (Matze) | platform reqs |
| Auto-Update | **Tauri-Updater** optional; Default zunächst **aus** (manueller Download), Endpoint/Manifest später | tauri updater |
| Versions-Quelle | **eine** Quelle (`app/package.json` `version`) → in `tauri.conf.json` gespiegelt; Tag `v<version>` | versioning |

## Phase 0 — `tauri build` + Sidecar-Packaging (lokal reproduzierbar)

- [ ] **Sidecar als Single-Binary** bündeln (Node-SEA / `pkg` / Bun) und als Tauri
      `externalBin` (`bundle.externalBin`) registrieren; der Rust-Spawn nutzt das
      gebündelte Binary statt Host-`node` (Dev bleibt Host-node).
- [ ] `task release:build` → `tauri build` erzeugt das unsignierte Bundle für die
      eigene Plattform inkl. Sidecar-Binary.
- [ ] Assert: das gebaute Bundle startet OHNE installiertes Node, bindet den Sidecar,
      öffnet ein Projekt (Smoke).

## Phase 1 — Versioning (eine Quelle der Wahrheit)

- [ ] `app/package.json` `version` ist die Quelle; ein kleines Script/Task spiegelt sie
      nach `tauri.conf.json` (`version`) — kein Drift. `task release:version -- <semver>`
      bumpt beide.
- [ ] Release-Tag-Konvention `v<version>`; CHANGELOG-Eintrag (Conventional-Commits-basiert,
      keine Auto-Attribution — `no-attribution-footers`).

## Phase 2 — Code-Signing / Notarisierung (Cert-gated, Klasse-C)

- [ ] **macOS:** Developer-ID-Signatur + `notarytool`-Notarisierung + Stapling; Keys aus
      CI-Secrets (`APPLE_*`). Lokal optional über Keychain.
- [ ] **Windows:** Authenticode-Signatur (Cert aus Secret/HSM). Linux: Signatur optional.
- [ ] Gate: ohne Zertifikate baut CI **unsigniert** + markiert das Artefakt klar als
      „unsigned (dev)". Signierter Pfad aktiviert sich, sobald die Secrets gesetzt sind.

## Phase 3 — CI-Release-Workflow (tag-getriggert, matrix)

- [ ] `.github/workflows/release.yml`: Trigger auf Tag `v*`; **Matrix** über
      macos-latest / windows-latest / ubuntu-latest; je: Setup (Rust + pnpm via
      `packageManager` wie in `ci.yml`), `task release:build`, Signing (Phase 2, falls
      Secrets), Upload der Artefakte als **GitHub-Release-Assets** (draft → publish).
- [ ] Wiederverwendung der `ci.yml`-Bausteine (pnpm-Pin, Node 22); Build-Cache für cargo.
- [ ] Hard-Floor: der Workflow **publisht nur auf einen echten `v*`-Tag**, den Matze
      explizit pusht; PR-Builds erzeugen nur Draft-Artefakte (kein Publish).

## Phase 4 — Auto-Update (optional, Decision-Gate)

- [ ] Tauri-Updater einbauen (Signatur-Key fürs Update-Manifest); Update-Endpoint
      (statisches `latest.json` im GitHub-Release oder eigener Host). Default aus, bis Matze
      es aktiviert.
- [ ] Assert: eine ältere Build-Instanz erkennt + lädt das neue signierte Release (Staging).

## Phase 5 — Distribution

- [ ] Download-Seite / README-Sektion mit den signierten Artefakten je Plattform; klare
      „unsigned dev build"-Kennzeichnung solange Phase 2 nicht aktiv.

## Akzeptanz

- `task release:build` erzeugt lokal ein lauffähiges Bundle ohne Host-Node-Abhängigkeit.
- Ein von Matze gepushter `v*`-Tag baut per CI-Matrix die Artefakte aller Zielplattformen
  und hängt sie an das GitHub-Release (signiert, sobald die Secrets stehen).
- Versions-Quelle ist eindeutig; kein `package.json`↔`tauri.conf.json`-Drift.
- Release/Publish bleibt explizit human-getriggert (Hard-Floor).
