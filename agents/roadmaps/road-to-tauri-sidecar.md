---
status: complete
block: Backend
depends_on: [road-to-backend-contracts]
unlocks: [road-to-real-git, road-to-worktree-runtime, road-to-capability-broker]
autonomy: "A (sidecar+registry) / C (Rust shell deferred)"
---

# Road to Tauri-Sidecar (B0)

**Goal:** Der **Bun/Node-TS-Sidecar** (headless, echtes JSON-RPC/NDJSON-IPC über Socket,
integrationstestbar) als Heim der Backend-Logik + Provider; die **Rust/Tauri-Shell dünn & deferred**;
plus die **Cross-IDE Recent-Projects-Registry** (passive maschinenweite Datei).

> Council: Sidecar trägt ~90 % der Logik + 100 % der autonomen Verifikation. Rust-Shell deferred
> (kein `cargo`). Cross-IDE = Registry-Datei hier, kein Daemon.

## Akzeptanz
- Sidecar startet headless; IPC-Round-Trip + Framing/Backpressure/Error-Integrationstests grün (Vitest/Node).
- `DesktopShell`-Seam der UI bekommt einen echten Sidecar-Client; Browser-Stub bleibt als Fallback.
- Rust-Shell: minimal, dokumentiert als deferred (Build braucht Toolchain) — **CI hängt nicht daran**.

## Phase 0 — Sidecar + IPC
- [x] TS-Sidecar (`sidecar/`) mit JSON-RPC/NDJSON über Unix-Socket; typed Request/Response + Event-Stream (B-pre-Subscribe). <!-- sidecar/protocol/* + sidecar/server/* + sidecar/client/socket-client-transport.ts; real-socket round-trip + streaming grün -->
- [x] Provider-Registry im Sidecar; UI-`contracts/` werden über den IPC-Client bedient (Mock→real Swap-Punkt). <!-- sidecar/registry + src/lib/sidecar/client/{providers,agent-proxy} + src/lib/desktop-shell.ts seam -->
- [x] Integrationstests: round-trip, Framing, Backpressure, Fehlerpfade, Reconnect. <!-- sidecar/test/{ndjson,peer,ipc-integration}.test.ts: 1-Byte-Flut, Byte-Cap, unknown-method/-provider, reconnect, 8 concurrent clients -->

## Phase 1 — Tauri-Shell (dünn, deferred)
- [x] Minimale Rust/Tauri-Shell, die die Vite-App lädt + den Sidecar spawnt; **deferred**: als dokumentierter Stub + TS-IPC-Harness, der dasselbe JSON-RPC spricht (Verifikation ohne `cargo`). <!-- sidecar/shell-stub/README.md (deferred, CI-frei) + sidecar/harness/ts-ipc-harness.ts + sidecar/test/ts-ipc-harness.test.ts (interleaved RPC + streaming + DesktopShell-Seam) -->

## Phase 2 — Cross-IDE Recent-Projects-Registry
- [x] Passive maschinenweite Registry-Datei (User-Config), atomic write / per-Entry-Files; Sidecar liest/schreibt „zuletzt offene Projekte". <!-- sidecar/recent/recent-projects.ts (atomic temp+rename, merge-by-path, recover-from-corrupt) + sidecar/test/{recent-projects,recent-ipc}.test.ts (concurrent-writer + release) -->
- [x] UI: Projekt-Switcher zeigt andere Instanzen/Projekte; Referenz/Jump ohne beide ins selbe Fenster zu laden. (Cross-Projekt-Session-Suche = B3-Follow-up, broker-scoped.) <!-- src/shell/ProjectSwitcher.tsx im TitleBar + src/shell/ProjectSwitcher.test.tsx; Pixel-Golden unverändert -->


## Council-Notizen
- Sidecar headless-testbar; Rust-Shell deferred — CI nicht an Tauri-Build koppeln (Lens B).
- Cross-IDE: kein Daemon/Socket-Mesh; passive Datei (Lens A, deckt sich mit der Feature-Note-Auflösung).
