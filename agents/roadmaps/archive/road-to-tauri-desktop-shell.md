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

## Architektur-Entscheidung (2026-06 — Override des Phase-1/2-Default)

**Statt eines bespoke Tauri-IPC-Byte-Channels wird die bestehende Loopback-WS-Bridge
wiederverwendet** (`sidecar/dev-bridge/main.ts` → `buildDevRegistry` = echte Provider +
`liveAgent` + `registerDevWorkspace`, broker-gated; Webview verbindet via
`WsClientTransport`/`connect-dev-bridge.ts`). Begründung: identische Trust-Boundary
(127.0.0.1-Loopback, wie dokumentiert), kein Rust-Duplikat des getesteten IPC-Stacks,
Shell bleibt reiner Transport. Der Gate erlaubt diesen Override explizit.

**Dev (`task dev`):** `beforeDevCommand: pnpm dev` startet Bridge (8787) + Vite (5173);
Tauri lädt 5173, der Webview verbindet die echte Bridge → echte Provider. Tauri verwaltet
den Lifecycle (killt den `pnpm dev`-Prozessbaum bei Quit; `dev.mjs` räumt via SIGTERM beide
Kinder ab). **Kein Rust-Spawn, kein Tauri-IPC-Channel für Dev nötig.**

**Build (standalone):** Ein gebündelter Sidecar + dessen Spawn ohne Host-`node` ist
Single-Binary-/Packaging-Arbeit → verschoben nach `road-to-desktop-release` (dort P0).

## Decision-Gates (PO — Defaults gesetzt, Override jederzeit)

| Gate | Default-Vorschlag | Quelle |
|---|---|---|
| Desktop-Framework | **Tauri 2.x** — der Code zeigt explizit darauf (`__CAPISCO_SIDECAR__`, „Rust/Tauri shell"); kein Electron-Dep, kleinerer Footprint | desktop-shell.ts |
| Fensterchrome | **Frameless** (`decorations: false`) + die bestehende `TitleBar` (Ampel, Drag-Region); kein doppeltes natives Chrome | TitleBar.tsx (Design 1:1) |
| Sidecar-Laufzeit im **Dev** | **Host-`node`** spawnt `sidecar/server/sidecar.ts` (kein Bundling nötig für Dev) — Packaging/Single-Binary ist `road-to-desktop-release` | release-roadmap |
| `task`-Runner-Ort | **`Taskfile.yml` im Repo-Root**, delegiert in `app/` (CLAUDE.md: Taskfile→`task`) | architecture-rule |

## Phase 0 — Taskfile + Tauri-Scaffold (das „läuft als App"-Gerüst)

- [x] **`Taskfile.yml`** (Repo-Root) mit den Kern-Targets: `task dev` (Desktop-Dev-App),
      `task dev:web` (= heutiges `pnpm dev`, Browser-Fallback), `task build`, `task test`,
      `task lint` — plus `task setup` (Newcomer-Bootstrap: Rust/rustup + pnpm-Deps) und
      `task typecheck`. Verifiziert via `task --list`.
- [x] **`app/src-tauri/`** scaffolden (Tauri 2): `Cargo.toml`, `tauri.conf.json`
      (Id `app.capisco.ide`, Fenster frameless 1440×880 `decorations:false`, lädt
      Vite-Dev in Dev / `../dist` im Build), `build.rs`, `main.rs`, `lib.rs`. `cargo build`
      kompiliert sauber (25s, `app v0.1.0` Finished). `src-tauri/target` + `gen/schemas` ist gitignored.
- [x] `@tauri-apps/cli` + `@tauri-apps/api` als Dev-/Dep; `tauri.conf.json`
      `beforeDevCommand: pnpm dev:ui`, `devUrl: http://localhost:5173`. `typecheck` grün
      (Deps brechen JS nicht).
- [~] DoD: `task dev` öffnet ein **leeres Tauri-Fenster** mit der Vite-UI (noch Mocks —
      Bridge kommt in Phase 2). <!-- deferred: cargo build kompiliert + Config valide; das tatsächliche Fenster-Öffnen braucht einen Display — Matze verifiziert per `task dev` lokal (Klasse-C-Sichtprüfung). -->
      <!-- resolved 2026-06-25 (Iron Law 3): reine Display-Sichtprüfung, lokal bei Matze (`task dev`). Wiring code-/test-verifiziert. Archiviert als Beleg. -->

## Phase 1 — Sidecar-Lifecycle (Rust spawnt + verwaltet den Prod-Sidecar)

- [x] Spawn beim App-Start: via `beforeDevCommand: pnpm dev` (statt Rust-Spawn/Unix-Socket
      — siehe Architektur-Entscheidung). Tauri startet den Prozessbaum (Bridge 8787 + Vite
      5173) und wartet auf `devUrl`.
- [x] **Lifecycle:** Tauri killt den `beforeDevCommand`-Prozessbaum bei App-Quit; `dev.mjs`
      räumt via SIGINT/SIGTERM Bridge + Vite ab — kein verwaister Prozess. Bridge unerreichbar
      → `connectDevBridge` fällt sauber auf Mocks zurück (kein weißer Screen).
- [~] Standalone-Build-Spawn (gebündelter Sidecar ohne Host-`node`, Socket-Cleanup-Test).
      <!-- deferred: Single-Binary-Packaging + dessen Spawn = road-to-desktop-release P0; Dev braucht keinen Rust-Spawn. -->
      <!-- resolved 2026-06-25 (Iron Law 3): weitergetragen → road-to-desktop-release P0 (:31-37). Archiviert als Beleg, nicht gedroppt. -->

## Phase 2 — Webview↔Sidecar-Bridge (`__CAPISCO_SIDECAR__` über Tauri-IPC)

- [-] Bespoke Tauri-IPC-Byte-Channel (Rust-Command) + `connect-tauri-bridge.ts`.
      <!-- cancelled: superseded durch WS-Bridge-Reuse (Architektur-Entscheidung); kein Rust-Duplikat des getesteten IPC-Stacks. -->
- [x] **Webview-Bridge:** `connect-dev-bridge.ts` (`WsClientTransport` → `installSidecarBridge`)
      wird unter `tauri dev` wiederverwendet — `getProviders()` liefert die echten IPC-Proxies.
- [x] `main.tsx`: ruft `connectDevBridge()` **vor** dem Render unter `import.meta.env.DEV`
      (gilt unter `tauri dev`, da Vite-Dev = DEV); kein Tauri → Browser-Pfad unverändert
      (Goldens/Tests byte-identisch — 96 Visual-Tests grün). Standalone-Build-Connect
      (`window.__TAURI__`, non-DEV) → `road-to-desktop-release`.
- [x] Assert: Bridge-Connect → `isDesktop()` true + `getProviders()` ≠ Mock; `projectFs`-
      Roundtrip über die Bridge liefert echte On-Disk-Daten — abgedeckt durch die
      Dev-Bridge-Testsuite (608 Tests) + verifizierten In-Process-Probe (950 Einträge, echter
      Datei-Inhalt). Sichtprüfung im Fenster = Phase 3 (Klasse-C).

## Phase 3 — `task dev` end-to-end + Native-Look (das eigentliche Ziel)

- [x] **`task dev`** orchestriert alles: `tauri dev` → `pnpm dev` (Bridge + Vite-HMR) +
      Tauri-Fenster + gebrückte echte Provider. Verifiziert: Config valide, `cargo build`
      kompiliert, Bridge-Wiring test-grün.
- [x] **Frameless-Fenster** + `TitleBar` als Drag-Region (`data-tauri-drag-region`); Ampel-
      Buttons verdrahtet (close/min/max via `@tauri-apps/api/window`, Tauri-gated über
      `window-controls.ts`); im Browser bleiben sie dekorativ (Visual 1:1, `.tl`-CSS-Reset).
      macOS-Vibrancy optional (Gate, offen).
- [~] DoD (Klasse-C, Matze): `task dev` → **native App** öffnet, Projekt öffnen → echter
      Datei-Baum + editierbarer Editor + broker-gateter Save; Agent-Chat real (mit
      `CAPISCO_ACP_CLI`); Quit beendet den Sidecar.
      <!-- deferred: Sichtprüfung des nativen Fensters braucht einen Display — Matze verifiziert lokal via `task dev`. Wiring + Provider sind code-/test-verifiziert. -->
      <!-- resolved 2026-06-25 (Iron Law 3): reine Display-Sichtprüfung, lokal bei Matze (`task dev`). Wiring/Provider code-/test-verifiziert. Archiviert als Beleg. -->

## Phase 4 — `task build` (lokaler Dev-Build, nicht Release)

- [x] `task build` → `pnpm exec tauri build` (`beforeBuildCommand: pnpm build`) ist verdrahtet
      und erzeugt das Bundle für die eigene Plattform.
- [~] Bundle startet standalone + bindet den Sidecar ohne Host-`node` + öffnet ein Projekt.
      <!-- deferred: das gebündelte Bundle braucht den Single-Binary-Sidecar + dessen Spawn (kein `pnpm dev` zur Laufzeit, DEV-Guard aus) = road-to-desktop-release P0. `task build` selbst baut bereits. -->
      <!-- resolved 2026-06-25 (Iron Law 3): weitergetragen → road-to-desktop-release P0 (:36-37). Archiviert als Beleg, nicht gedroppt. -->

## Akzeptanz

- `task dev` startet Capisco als **echte Fenster-App** mit echten Providern (kein Browser,
  keine Mocks); Projekt-Öffnen + Editor + Save funktionieren; Quit räumt den Sidecar ab.
- Browser-Pfad (`task dev:web` / `pnpm dev`) bleibt unverändert; Visual-Goldens byte-identisch.
- Jeder Agent-/FS-Seiteneffekt bleibt broker-gated — der Shell ist reiner Transport.
- Sidecar-Packaging (Single-Binary) + signierte Artefakte sind **out of scope** → Release-Roadmap.
