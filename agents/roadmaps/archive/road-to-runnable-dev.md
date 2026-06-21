---
status: complete
block: Backend
depends_on: [road-to-session-store-and-acp]
autonomy: "A (live local wiring) / B (real ACP agent key-gated)"
---

# Road to Runnable-Dev (B7) — „Entwurf" → benutzbare lokale App

**Goal:** `pnpm dev` von „zeigt nur Mocks" zu **benutzbar** machen: echtes Projekt öffnen,
echter Datei-Explorer, **echter Editor (laden/ändern/speichern via Broker)**, echtes Git,
Worktree anlegen, Session starten — alles gegen den **live verbundenen Sidecar**, ohne
Tauri/cargo. Plus: den echten ACP-Agent-Adapter (option 1, key-gated) anschließen.

> Befund: `desktop-shell.ts` nutzt Mocks, weil keine Sidecar-Brücke injiziert ist und der
> Sidecar nur Unix-Socket spricht (Browser kann das nicht). Lösung: Dev-WebSocket-Brücke.
> Macht zugleich den echten `perform`-Adapter scharf → schließt das Security-„must-fix"
> (FS/Shell nur durch den Broker, mit Architektur-Test).

## Akzeptanz
- `pnpm dev` startet UI **und** Sidecar; die App läuft gegen echte Provider (kein Mock-Fallback im Dev).
- Man kann ein **echtes Projekt öffnen** (Pfad/Recent), sieht den **echten** Datei-Baum (echte Git-Marker), öffnet eine Datei mit **echtem Inhalt**, **editiert + speichert** (broker-gegateter FS-Write, der die Datei real ändert), legt einen **Worktree** an, startet eine **Session** (Stub-Agent) — je ein Integrationstest.
- **Security-Gate (must-fix aus dem Review):** der echte `perform`-Adapter (fs/shell/net) ist **nur** innerhalb `broker.execute` erreichbar — Lint/Architektur-Test verbietet `child_process`/`fetch`/`fs`-Writes außerhalb `sidecar/broker/`-mediierter Pfade; denied call ⇒ kein Seiteneffekt.
- Dev-Brücke bindet **nur `127.0.0.1`**, dev-only, klar markiert (kein Prod-Pfad). Broker mediiert weiterhin jede Capability.

## Phase 0 — Dev-WebSocket-Brücke
- [x] `dev:sidecar`: Sidecar-Prozess + localhost-WS, der die IPC (JSON-RPC/NDJSON + Event-Stream) transportiert; WS-`Transport`-Impl (browser-seitig) erfüllt dasselbe `Transport`-Interface.
- [x] Vite-Dev injiziert `__CAPISCO_SIDECAR__` (WS-Transport) → `getProviders()` nimmt die echten IPC-Proxies. `pnpm dev` startet beides (concurrently). Integrationstest: Browser-Client über WS erreicht echtes Git in einem Temp-Repo.

## Phase 1 — Projekt öffnen + echter Explorer
- [x] Projekt öffnen via Pfad-Eingabe/Recent-Projects → Sidecar öffnet Repo → echter Datei-Baum (echte Git-Marker, virtualisiert). Klick auf Datei lädt **echten** Inhalt in den Editor.

## Phase 2 — Editor lesen/schreiben (echter perform-Adapter)
- [x] CodeMirror editierbar; **Save → broker.execute(file-write) → echte Datei-Änderung** auf der Platte; dirty/save-Flow; Undo/lokale History (§5.1) optional.
- [x] Echter `perform`-Adapter (fs read/write, später shell/net) **eingezäunt** auf den Broker-Chokepoint + Architektur-/Lint-Test (Review-must-fix).

## Phase 3 — Worktree + Session live
- [x] Worktree anlegen/wechseln (echt) gegen das offene Repo; Session (Stub-Agent) im Worktree starten; ToDo→Agent gegen den live Sidecar.

## Phase 4 — Echter ACP-Agent (option 1, key-gated)
- [x] Adapter, der eine echte ACP-fähige Agent-CLI spawnt (sealed subprocess + client-assigned taint — Controls liegen). Key/CLI aus Config/Keychain. Gegen Stub verifiziert; **real, sobald Key/CLI da**. Re-Audit-Gate beim Scharfschalten.

## Council/Review-Notizen
- Dev-Brücke = WS (kein Tauri nötig); Prod-Pfad bleibt Tauri-Socket (deferred).
- Editor-Save macht den echten `perform`-Adapter scharf → das Security-„must-fix" wird hier geschlossen, nicht nur dokumentiert.
