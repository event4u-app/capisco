---
status: complete
block: Backend
depends_on: [road-to-tauri-sidecar]
unlocks: [road-to-session-store-and-acp]
autonomy: "A (policy/logic) / B (OS keychain deferred)"
---

# Road to Capability-Broker (B4)

**Goal:** Der un-umgehbare Execution-Chokepoint — `(Principal × Capability × Scope) → Entscheidung`,
Secret-Tresor (capability-by-reference), Audit-Log, Prod-read-only-Invariante. Reine Logik, voll
auto-verifizierbar. Echter OS-Keychain deferred.

> Council Lens C: **wichtigste Guardrail** — „keine Agent-Capability außer durch den Broker", muss
> **vor B3** stehen. Lens C: B4 ist 2–3× unterskaliert (per-OS-Keychain, Execution-Layer-Injection,
> Audit, Policy-Engine sind je eigene Arbeit).

## Akzeptanz (Security-MUST-NOTs als harte Tests)
- Broker-Gate ist der einzige Pfad zu Shell/File/Netz/DB/Secret — Architektur-Test: keine Capability ohne Broker-Call.
- **Secret nie als Wert** im Context/Log/Store — nur `credentialRef`; Injection nur im Execution-Layer (nie env-var/CLI-arg an Subprozess). Test beweist es.
- **Prod read-only**: `readonly` aus `env` abgeleitet, kein „remember"; nur per-Befehl-Einmal-Escape, danach auto-read-only. Test: „dauerhaft erlauben" ist strukturell unkonstruierbar.
- **Append-only Audit** vor Ausführung (Akteur + Capability + credentialRef). Grant-Achse persistiert.

## Phase 0 — Policy-Engine
- [x] `(Principal × Capability × Scope) → decision`; Grant-Achse (`once|session|scoped|deny`) persistiert pro Projekt; `PermissionRequest.resolve()` (B-pre) verdrahtet. <!-- GrantPolicyEngine (sidecar/broker/policy-engine.ts): fail-closed decide(), per-project+scope grant store, resolve() = §3 return channel; broker-provider.resolve over the wire. Human not privileged. -->
- [x] **Human-gated Default-Allowlist** (konservativ, human-authored — Build erfindet keine weite Allowlist): z.B. `Bash(git status:*)` allow, `Bash(rm:*)` ask. Als Config, nicht Code. <!-- DEFAULT_GRANT_CONFIG (sidecar/broker/default-grants.ts): read-only allow, mutating ask, rm/sudo deny. Config object, not hard-coded logic. Empty productionDatasources by default. -->

## Phase 1 — Secret-Tresor + Audit
- [x] `SecretStore`-Interface + `InMemorySecretStore` (Fake); capability-by-reference; Execution-Layer-Injection. **Deferred:** echter OS-Keychain (macOS `security`/DPAPI/libsecret) als Swap. <!-- contracts/broker.ts SecretStore (no get(): string — only inject(ref, use) scopes value to a callback); InMemorySecretStore (#values private). Tests prove value never leaves as value/env/CLI-arg. -->
- [x] Append-only Audit-Store; bidirektionales Zurückschreiben (Agent legt Test-User an → Vorschlag in den Tresor, mit Freigabe, nie in den Chat). <!-- InMemoryAuditStore (record/list only, frozen snapshots, monotonic seq, refuses value-shaped credentialRef); proposeVaultWrite/commitVaultWrite — human-approval gated, never via chat. -->

## Phase 2 — Prod-Invariante + Egress-Gate
- [x] Datasource prod read-only (derived); per-Befehl-Einmal-Schreib-Escape (auto-revert). <!-- Broker.execute enforces: prod db-write needs a fresh single-shot WriteEscape (from B-pre, {datasource,command,consumed} only — no session/remember field). Test: permanent prod-write is structurally unconstructable. -->
- [x] **Egress-Gate**: jeder Write/Netz/Prod-Write **aus untrusted Agent-Output** → harter `PermissionRequest`, nie auto. Untrusted-Output = Daten, nie Instruktionen. <!-- policy-engine: fromUntrusted + egress kind → forced ask; a session/scoped grant CANNOT pre-clear it. Reason cites lethal trifecta. -->

## Status
Alle Phasen abgeschlossen + grün (tsc/lint/vitest/build/ladle/playwright). 39 Broker-Tests
(`sidecar/test/broker.test.ts` 32 + `broker-ipc.test.ts` 7), jede Security-MUST-NOT als
passender Test. **Nicht archiviert** — Security/Human-Sign-off ausstehend (Default-Allowlist,
Prod-Datasource-Liste, Default-Scopes bleiben human-gated).

## Human-gated (NIE autonom)
Default-Grant-Allowlist · was „production" ist · Default-Scopes · Tenant-Fan-out-Write · Presence-Server.

## Council-Notizen
- Gate-Interceptor **vor** B3 (Lens A+C) — sonst Retrofit durch den heißesten Pfad.
- Lethal-Trifecta: privater Zugriff × untrusted Ingest × Egress → Egress hinter Human-Gate brechen (Lens C).
