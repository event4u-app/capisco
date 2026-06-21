---
status: complete
block: Backend
depends_on: [road-to-capability-broker, road-to-worktree-runtime]
unlocks: [road-to-quality-grounding]
autonomy: "A (store+transport+stub) / B (real agents deferred)"
---

# Road to Session-Store & ACP (B3) — Micro-Nordstern

**Goal:** Der agent-native Kern echt: persistenter **Session-Store** (resume/search/retry-as-branch)
+ **ACP-Transport** (JSON-RPC stdio) — getestet gegen einen **Stub-ACP-Agenten**. Jede Capability
läuft durch den **Broker (B4)**. Echte Agent-CLIs deferred.

> Council: Session-Store ist „Pflicht ab Tag eins" (§2.2) → **vor** dem ACP-Wire. Broker-Gate ist
> Prereq (B4). Erster Durchstich = **ToDo→Agent** (§4.11): klick → broker-gegateter Stub-Session →
> Tokens/Status streamen in den Tree.

## Akzeptanz
- **Keine Agent-Capability ohne Broker-Call** (Architektur-Test, B4-Invariante).
- Session-Store persistiert; resume + Volltext-Suche + **retry verzweigt** (überschreibt nicht).
- ACP-Transport getestet gegen `stub-acp-agent.mjs` (scripted stdio → Events/ToolAction/PermissionRequest); Token/Runtime-Telemetrie aggregiert in den Tree. **Echte CLIs deferred** (dünner Swap).

## Phase 0 — Session-Store (vor ACP)
- [x] Persistenter Store (Session/Message/ToolAction/Tree); resume (rehydrieren), Suche (Index), **retry-as-branch**, copy. <!-- contracts/session-store.ts + sidecar/session/in-memory-session-store.ts; session-store.test.ts (15) + session-ipc.test.ts (4, über Socket-Spine) -->

## Phase 1 — ACP-Transport + Stub-Agent
- [x] ACP JSON-RPC über stdio; `stub-acp-agent.mjs` (deterministisch) für Tests; Event-Stream → Subscribe-Kanal (B-pre) → Session-Tree. <!-- contracts/acp.ts + sidecar/acp/{stub-acp-agent.mjs,acp-transport.ts,acp-session.ts}; acp-transport.test.ts -->
- [x] **Jeder Tool-/Shell-/File-/Netz-Zugriff des Agenten geht durch den Broker** (B4) — der Stub-Agent kann nichts am Broker vorbei. <!-- AcpSession beantwortet jede session/request_permission nur über broker.authorize→Human-Gate→broker.execute; Stub hat keine direkte fs/shell/net-Capability. acp-transport.test.ts: deny blockiert, untrusted-egress harter Gate, append-only Audit vor Ausführung -->

## Phase 2 — Micro-Nordstern: ToDo → Agent
- [x] Klickbares Markdown-ToDo (`- [ ]`) → „An Agent senden" startet broker-gegatete Session (Stub) im aktuellen Worktree; Status-Rückkopplung (offen→in Arbeit→erledigt). <!-- contracts/todo.ts + src/lib/todo/todo-parser.ts + sidecar/todo/{todo-provider.ts,acp-todo-starter.ts}; todo-agent.test.ts (end-to-end Mikro-Nordstern) -->

## Deferred (braucht Dich)
Echte ACP-Agent-CLIs (Claude Code/Codex/Gemini) + LLM-API-Keys. Cross-Projekt-Session-Suche (broker-scoped, Secret-Leak-Gate) als Follow-up.

## Council-Notizen
- Sync→Streaming-Spine über Stub beweisen, bevor echte Agenten dran sind (Lens A+B).
- Secrets nie als env/CLI-arg an den ACP-Subprozess (Lens C, MN-1).
