---
status: ready
block: Desktop / Packaging
depends_on: [road-to-runnable-dev, road-to-composer-context-runtime]
autonomy: "A (Tauri-Scaffold + Taskfile + Bridge-Verdrahtung + Tests) / B (Sidecar-Spawn-Lifecycle) / C (Native-App-Look/-Feel-Abnahme)"
---

# Road to Tauri-Desktop-Shell — Capisco läuft als echte App (nicht im Browser)

**Goal:** Capisco als **native Desktop-App** starten — `task dev` öffnet ein echtes
Fenster mit der IDE und den **echten Providern** (kein Browser, keine Mocks). Die
Architektur ist bereits darauf ausgelegt: `src/lib/desktop-shell.ts` wählt die echten
IPC-Provider, sobald ein Host `globalThis.__CAPISCO_SIDECAR__` (einen `Transport`)
injiziert hat; der Prod-Sidecar (`sidecar/server/sidecar.ts`) ist ein Unix-Socket-
JSON-RPC-Server. Es fehlt nur der **Tauri-Shell**, der (1) den Sidecar spawnt, (2) den
Socket an das Webview brückt und `__CAPISCO_SIDECAR__` setzt, (3) den Vite-Build lädt.

> Referenz (Integrationspunkte, real im Code):
> - `src/lib/desktop-shell.ts` — `SidecarBridge { transport }`, `installSidecarBridge`,
>   `isDesktop()` (prüft `__CAPISCO_SIDECAR__`).
> - `src/lib/dev/connect-dev-bridge.ts` — die **Vorlage**: baut einen `WsClientTransport`
>   und ruft `installSidecarBridge`. Der Tauri-Pfad ist das Analogon über Tauri-IPC.
> - `sidecar/server/sidecar.ts` + `sidecar/server/socket-transport.ts` — der Unix-Socket-
>   Server, den der Shell spawnt + pipet.
> - `src/shell/TitleBar.tsx` — eigene Titelbar (`.tb-traffic` Ampel) → frameless Fenster.

> **Trust-Boundary:** der Sidecar bindet einen **lokalen Unix-Socket** (kein Netz); die
> Webview↔Sidecar-Brücke läuft über **Tauri-IPC im selben Prozessbaum** (analog zur
> Dev-WS-Bridge auf `127.0.0.1`). Jeder Agent-Seiteneffekt bleibt broker-gated — der
> Shell transportiert nur Bytes, er umgeht den Broker nie.

## Decision-Gates (PO — Defaults gesetzt, Override jederzeit)

| Gate | Default-Vorschlag | Quelle |
|---|---|---|
| Desktop-Framework | **Tauri 2.x** — der Code zeigt explizit darauf (`__CAPISCO_SIDECAR__`, „Rust/Tauri shell"); kein Electron-Dep, kleinerer Footprint | desktop-shell.ts |
| Fensterchrome | **Frameless** (`decorations: false`) + die bestehende `TitleBar` (Ampel, Drag-Region); kein doppeltes natives Chrome | TitleBar.tsx (Design 1:1) |
| Sidecar-Laufzeit im **Dev** | **Host-`node`** spawnt `sidecar/server/sidecar.ts` (kein Bundling nötig für Dev) — Packaging/Single-Binary ist `road-to-desktop-release` | release-roadmap |
| `task`-Runner-Ort | **`Taskfile.yml` im Repo-Root**, delegiert in `app/` (CLAUDE.md: Taskfile→`task`) | architecture-rule |

## Phase 0 — Taskfile + Tauri-Scaffold (das „läuft als App"-Gerüst)

- [ ] **`Taskfile.yml`** (Repo-Root) mit den Kern-Targets: `task dev` (Desktop-Dev-App),
      `task dev:web` (= heutiges `pnpm dev`, Browser-Fallback), `task build`, `task test`,
      `task lint`. `task dev` ist das Primärziel dieser Roadmap.
- [ ] **`app/src-tauri/`** scaffolden (Tauri 2): `Cargo.toml`, `tauri.conf.json`
      (App-Id `app.capisco`, Fenster frameless, lädt den Vite-Dev-Server in Dev /
      `../dist` im Build), `build.rs`, minimal `main.rs`.
- [ ] `@tauri-apps/cli` + `@tauri-apps/api` als Dev-Deps; `tauri.conf.json`
      `beforeDevCommand` = der Vite-Dev-Server, `devUrl` = dessen URL.
- [ ] DoD: `task dev` öffnet ein **leeres Tauri-Fenster** mit der Vite-UI (noch Mocks —
      die Bridge kommt in Phase 2). Kein Sidecar-Crash, sauberes Quit.

## Phase 1 — Sidecar-Lifecycle (Rust spawnt + verwaltet den Prod-Sidecar)

- [ ] Tauri-Rust spawnt beim App-Start `node sidecar/server/sidecar.ts` (Dev: Host-node)
      mit einem **per-Run Unix-Socket-Pfad** (z. B. unter dem App-Daten-/Temp-Dir),
      wartet bis der Socket lauscht, hält das Child-Handle.
- [ ] **Lifecycle:** Sidecar wird bei App-Quit/Crash sauber beendet (kill + Socket-Cleanup);
      kein verwaister Prozess. Fehlerpfad: Sidecar startet nicht → ehrlicher Fehler im
      Fenster, kein weißer Screen.
- [ ] Assert (Rust-Integrationstest oder Smoke): App-Start bindet den Socket; Quit
      hinterlässt keinen Prozess/Socket.

## Phase 2 — Webview↔Sidecar-Bridge (`__CAPISCO_SIDECAR__` über Tauri-IPC)

- [ ] **Rust-Seite:** ein Tauri-Command/Channel, das den Unix-Socket ↔ Webview pipet
      (duplex Byte-Stream über Tauri-IPC).
- [ ] **Webview-Seite:** `src/lib/desktop/connect-tauri-bridge.ts` (Analogon zu
      `connect-dev-bridge.ts`): baut einen `Transport` über die Tauri-IPC und ruft
      `installSidecarBridge` → `getProviders()` liefert die echten IPC-Proxies.
- [ ] `main.tsx`: unter Tauri (`window.__TAURI__`) `connectTauriBridge()` **vor** dem Render
      (wie heute `connectDevBridge()` in Dev); kein Tauri → bestehender Browser-Pfad
      unverändert (Goldens/Tests byte-identisch).
- [ ] Assert: unter Tauri ist `isDesktop()` true und `getProviders()` ≠ Mock; ein
      `projectFs.getTree`-Roundtrip über die Bridge liefert echte On-Disk-Daten.

## Phase 3 — `task dev` end-to-end + Native-Look (das eigentliche Ziel)

- [ ] **`task dev`** orchestriert alles: Vite-Dev + Tauri-Fenster + gespawnter Sidecar +
      gebrückte echte Provider, mit **Hot-Reload** (Vite-HMR im Webview).
- [ ] **Frameless-Fenster** + die bestehende `TitleBar` als Drag-Region; Ampel-Buttons
      verdrahtet (close/min/max via Tauri-Window-API); macOS-Vibrancy optional (Gate).
- [ ] DoD (Klasse-C, Matze): `task dev` → **native App** öffnet, Projekt öffnen → echter
      Datei-Baum + editierbarer Editor + broker-gateter Save; Agent-Chat real (mit
      `CAPISCO_ACP_CLI`); Quit beendet den Sidecar.

## Phase 4 — `task build` (lokaler Dev-Build, nicht Release)

- [ ] `task build` → `tauri build --debug` (oder unsigniert) erzeugt ein **lokal lauffähiges
      App-Bundle** für die eigene Plattform (Sidecar gespawnt wie in Dev). Signierte,
      verteilbare Artefakte + CI = `road-to-desktop-release`.
- [ ] Assert: das Bundle startet, bindet den Sidecar, öffnet ein Projekt.

## Akzeptanz

- `task dev` startet Capisco als **echte Fenster-App** mit echten Providern (kein Browser,
  keine Mocks); Projekt-Öffnen + Editor + Save funktionieren; Quit räumt den Sidecar ab.
- Browser-Pfad (`task dev:web` / `pnpm dev`) bleibt unverändert; Visual-Goldens byte-identisch.
- Jeder Agent-/FS-Seiteneffekt bleibt broker-gated — der Shell ist reiner Transport.
- Sidecar-Packaging (Single-Binary) + signierte Artefakte sind **out of scope** → Release-Roadmap.
