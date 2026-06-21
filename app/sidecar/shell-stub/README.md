# Capisco desktop shell — Rust/Tauri stub (DEFERRED, B0 Phase 1)

This directory documents the **thin** Rust/Tauri shell. It is deliberately a
**stub**: building it requires a `cargo`/Rust toolchain that is not present in
this environment, so it is **not part of CI** and is **not** wired into any
`pnpm` gate. Its verifiable twin — the [`../harness/ts-ipc-harness.ts`](../harness/ts-ipc-harness.ts)
— stands up the identical JSON-RPC/NDJSON protocol over an in-process pipe, so
the protocol the shell relies on is fully exercised without `cargo`.

## What the real shell does (and only this — it stays thin)

Per concept §6, the shell is `~boilerplate`; ~90 % of the logic lives in the
TypeScript sidecar. The shell's entire job is two seams:

1. **Load the Vite app** into the OS webview (no bundled Chromium — Tauri uses
   the system webview, the small-footprint reason Electron was rejected).
2. **Spawn the sidecar process** (`node sidecar/main.ts --socket <path>` or the
   compiled single-binary) and **bridge its unix socket to the webview** as the
   `globalThis.__CAPISCO_SIDECAR__` byte transport the
   [`DesktopShell` seam](../../src/lib/desktop-shell.ts) consumes.

That bridge transport satisfies the same `Transport` interface the harness
provides. Swapping the harness for the real Rust bridge is a **transport swap**
only — the protocol (`protocol/`), the provider registry (`registry/`), the
providers, the IPC client (`client/`), and the `DesktopShell` seam are all
unchanged.

## Reference skeleton (not built here)

A minimal `src-tauri/` would look like:

```
src-tauri/
  Cargo.toml          # tauri + tauri-build deps
  tauri.conf.json     # points build.devUrl → vite dev, build.frontendDist → dist/
  src/main.rs         # spawn sidecar, expose an IPC command bridging socket↔webview
```

`tauri.conf.json` (shape):

```jsonc
{
  "build": {
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": { "windows": [{ "title": "Capisco", "width": 1440, "height": 880 }] }
}
```

`main.rs` (shape — pseudocode, the only Rust the project owns):

```rust
// On setup: spawn the sidecar, connect to its unix socket, and forward bytes
// between that socket and the webview via a Tauri command + event channel.
// The webview installs `globalThis.__CAPISCO_SIDECAR__ = { transport }` where
// `transport` wraps `invoke('sidecar_send', …)` (send) and a Tauri event
// listener (onData). NDJSON framing + JSON-RPC are owned by the shared TS
// protocol layer — the Rust side is a dumb byte pump.
```

## How to build it later (when a toolchain is available)

```bash
# one-time: install Rust + the Tauri CLI
cargo install create-tauri-app   # or: pnpm add -D @tauri-apps/cli
# then, from app/:
pnpm tauri dev      # spawns sidecar + opens the webview
pnpm tauri build    # produces the signed desktop binary
```

Until then the harness is the source of truth for the protocol contract, and
the browser-only Vite app (mock fallback) is the shipped, fully-functional
runtime.
