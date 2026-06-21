# Capisco — Backend-Track Overview (B-Serie)

*Stand: 2026-06-21. Track 2: „Shell → funktionierende IDE". Die UI-Shell (R0–R6) ist fertig
(Mock-Provider hinter `app/src/contracts/`). Dieser Track ersetzt Mocks durch echte
Implementierungen + fügt Tauri-Shell, Sidecar, IPC und die drei Primitive (Worktree,
Session-Tree, Broker) hinzu. Quelle: Konzept §2/§3/§4/§6/§7/§8.*

Geprüft vom Council (3 Linsen: Architektur/Sequencing · Autonomie/Verifizierbarkeit ·
Security/Scope) am 2026-06-21. Deren load-bearing Befunde sind unten verankert.

---

## 0. Framing (ehrlich)

- **Backend ist NICHT wie das UI verifizierbar.** Echtes Git/IPC/Sidecar/Worktrees/Broker-Logik/
  Quality-Runner kann der Agent **autonom bauen UND prüfen** (Tests gegen Temp-Repos/Fixtures/Fakes).
  ACP-Agenten, Docker, Jira/GitHub-Tokens, OS-Keychain, LLM-Keys, Rust/Tauri-Build **brauchen Dich**.
- **Default (wie UI):** real wo autonom-verifizierbar; **Interface + deterministischer Fake** wo
  extern-abhängig — gleiche `contracts/`-Form, echter Adapter ist ein dünner Swap, sobald Du die
  Dependency lieferst.
- **Der Sidecar (TS) trägt ~90 % der Logik und 100 % der autonomen Verifikation.** Die Rust/Tauri-
  Shell bleibt dünn und ist **deferred** (kein `cargo`/Toolchain in dieser Umgebung).
- **Konzept §15:** Broker, ACP, Container-Orchestrierung, DAP sind der „low-AI-leverage backbone" —
  hier liegt das Risiko, nicht die UI-Fläche.

## 1. Decomposition & Reihenfolge

| # | Roadmap | Autonomie | Status |
|---|---|---|---|
| B-pre | `road-to-backend-contracts` | A (voll auto) | ausführbar |
| B0 | `road-to-tauri-sidecar` | A (Sidecar+Registry) / **C (Rust-Shell deferred)** | ausführbar |
| B1 | `road-to-real-git` | A | ausführbar |
| B2 | `road-to-worktree-runtime` | A (Worktrees) / **B (Container deferred)** | ausführbar |
| B4 | `road-to-capability-broker` | A (Logik) / **B (OS-Keychain deferred)** | ausführbar |
| B3 | `road-to-session-store-and-acp` | A (Store+Transport+Stub) / **B (echte Agenten deferred)** | ausführbar |
| B5 | `road-to-quality-grounding` | A (Runner) / B (KI-Review deferred) | strukturiert |
| B6 | `road-to-task-forge` | B (Fixtures auto / **Live-Tokens deferred**) | strukturiert |

**Abhängigkeitsgraph (Council-Korrektur):** B-pre → B0 → B1 → B2(Worktrees) → **B4-Gate → B3**
(Broker-Interceptor **vor** ACP — nicht danach) → B5 → B6. Cross-IDE-Registry fällt in B0.

**Micro-Nordstern (erster vertikaler Durchstich, Konzept §4.11):** ToDo-Markdown → broker-gegateter
ACP-Session-Start (Stub-Agent) → Tokens/Status streamen in den Session-Tree. Beweist die ganze
Spine (Editor → IPC → Broker-Gate → ACP-stdio → persistenter, verzweigbarer Session-Store →
gestreamtes Transkript) **ohne** Git/Quality/Tickets. Läuft zuerst im *aktuellen* Worktree.

## 2. Contracts v2 — der Prerequisite (B-pre), warum

Die heutigen `contracts/` sind **synchron, Snapshot-pull** (`listSessions(): Session[]`). Echtes
ACP/Git/IPC ist **asynchron + streaming**. Ohne Fix wird die UI später umgebaut. B-pre macht:

- **Async überall** (`Promise<…>`) + **Event/Subscribe-Kanal** für Sessions (Token-Deltas, Status,
  Tool-Calls als Events — nicht Polling).
- **`PermissionRequest.resolve(decision)`** + Grant-Achse (`once / session / scoped / deny`) — heute
  fire-and-forget ohne Rückkanal.
- **Strukturierte Telemetrie** (`tokensIn/tokensOut/runtimeMs`, nach oben aggregierend) statt
  vorgerenderter Meta-Strings.
- **Repo ≠ Worktree**: `workspace.Project` konflatiert beide (§2.1: ein Repo, N Worktrees) → trennen.
- **`Datasource.readonly` → abgeleitete Invariante** aus `env==="production"`, **nicht** optional/
  settable; + per-Befehl-Einmal-Schreib-Escape-Form (§3.3). **Security-Fix, sofort.**
- **Retry-as-branch** Session-Tree (§2.2 „verzweigt, überschreibt nicht") + **History-2** Shadow-
  Store-Interface (§5.1, „Agent hat meine Datei zerlegt"-Rettungsnetz).
- Mocks + UI-Consumer mitziehen; alle UI-Gates bleiben grün.

## 3. Security-Invarianten (HARTE Akzeptanz in B3/B4 — architektonisch, nicht UI)

```
KEINE AGENT-CAPABILITY EXISTIERT AUSSER DURCH DEN BROKER.
DER BROKER IST EIN UN-UMGEHBARER EXECUTION-CHOKEPOINT — VOR B3.
```

1. **Secrets nie im LLM-Context.** Broker injiziert Credentials **nur im Execution-Layer**
   (HTTP/Browser/DB-Driver), **nie** als env-var/CLI-arg an einen ACP-Subprozess (den der Agent
   `cat`-en/zurücklesen könnte). Capability-by-reference (`credential: staging-admin`).
2. **Prod read-only = Invariante.** Abgeleitet aus `env`, nicht settable, kein „remember"/Session-
   weites Schreiben. Einziger Ausstieg: per-Befehl-einmal-explizit, danach automatisch wieder
   read-only. Die „dauerhaft erlauben"-Option muss **strukturell unkonstruierbar** sein.
3. **Human-in-the-Loop bei Egress aus untrusted Output.** Agent-/Ticket-/Web-/Subagent-Output ist
   **Daten, nie Instruktionen** (Lethal-Trifecta). Jeder Egress/Write/Prod-Write daraus → harter
   `PermissionRequest`-Gate, nie auto-gefeuert.
4. **Append-only Audit** vor Ausführung (Akteur + Capability + credentialRef, nie Wert).

## 4. Human-gated — NIE autonom (Build muss anhalten/Default konservativ)

- **Default-Grant-Allowlist** (was ein Agent ohne Nachfrage darf) — konservativ, human-authored.
- **Welche Datasource `production` ist** — human-confirmed, nie aus Connection-String inferiert.
- **Default-Grant-Scopes** (permanent ist Foot-Gun → Default „ask").
- **Presence/Sync-Server aktivieren** (bricht local-first) — explizit opt-in.
- **Tenant-Fan-out-Write** (§4.7) — per-Ausführung-Bestätigung, nie persistiert.

## 5. Deferred — braucht Deine Dependency (Interface+Fake gebaut, echter Swap später)

| Deferred | Fake im Build | Echter Swap braucht |
|---|---|---|
| Rust/Tauri-Window | TS-IPC-Harness spricht dasselbe JSON-RPC | `cargo`/Rust-Toolchain |
| Echte ACP-Agenten | `stub-acp-agent.mjs` (scripted stdio) | Claude-Code/Codex-CLI + LLM-Keys |
| Container-Runtime | `FakeRuntimeProvider` (deterministische `docker stats`-Frames) | Docker-Daemon |
| OS-Keychain | `InMemorySecretStore` | macOS `security` / DPAPI / libsecret |
| Jira/Linear/GitHub | `FixtureTaskProvider` (recorded JSON) | API-Tokens |

## 6. Cross-IDE-Linking (Deine `feature-ide-linking.txt`) — Auflösung

**Kein Daemon, kein Socket, kein LSP-multi-root.** Minimal: eine **passive maschinenweite
Recent-Projects-Datei** in User-Config (atomic write / per-Entry-Files für Nebenläufigkeit) →
fällt in **B0** (Sidecar-Config). Das reichere „Wissen aus A-Session in B nutzen" ist **kein**
eigener Track, sondern eine **broker-scoped Cross-Projekt-Session-Suche** als B3-Follow-up
(Secret-Leak-Risiko: fremder Projekt-Context darf nicht in einen Cloud-Prompt lecken — §3.2).

## 7. Verifikation (Sidecar headless, Rust deferred)

- **Sidecar = headless integrationstestbar** (IPC-Server, Provider, Broker — Vitest/Node). Hier
  lebt die autonome Verifikation. Fakes (Stub-ACP, InMemorySecret, FakeRuntime, Fixtures) hinter
  den `contracts/`-Interfaces.
- **Echtes Git** gegen Temp-Repos (hermetisch). **Quality-Runner** gegen eslint/tsc (schon da).
- **CI hängt NICHT von einem Tauri-Build ab.** Die bestehenden UI-Gates (vitest/playwright/ladle)
  bleiben grün; Sidecar bekommt eigene Integrationstests.
- Rust-Shell: dünn, minimal getestet, **explizit deferred**.

---

## 8. Folge-Roadmaps (post-B8) — Council-geprüft 2026-06-21

Aus `agents/tmp` (Konzept §5.10 Token-Ökonomie + die drei `feature-*.txt` + `design-update-v1.md`
+ externe Review) abgeleitet; vom Council (3 Linsen: Architektur/Sequencing · Autonomie/
Verifizierbarkeit · Security/Scope) geprüft. **Reihenfolge wert-zuerst, Befunde in den Files
verankert.**

| # | Roadmap | Block | Autonomie | Reihenfolge |
|---|---|---|---|---|
| F1 | `road-to-design-sync-v1` | UI-Sync | A (Struktur) / C (Fidelity) | **zuerst** — schließt offenes R2-Gate, baut das Meter (Projektion) |
| F2 | `road-to-local-artifact-hygiene` | Backend | A (voll auto, Temp-Repos) | **parallel zu F1** (disjunkter Code) |
| F3 | `road-to-token-economy` | Token-Ökonomie | A/B/C | nach F1 (erbt Meter), baut Mechanik |
| F4 | `road-to-cross-project-knowledge` | Cross-Projekt | A (P1) / human-gated (P2) | **zuletzt** — höchstes Risiko, Voll-Trifecta in P2 |

**Drei load-bearing Council-Korrekturen** (sonst falsch gebaut):

1. **Token-Meter-Naht:** das *visuelle* Meter + Schwellwert-Popover gehört in **F1** (Prototyp-
   Delta, reine Projektion); die *Mechanik* (Rot→Handoff mit Kompression, RTK, Caveman) in **F3**.
   F1 baut kein Verhalten („New session" = Stub), F3 füllt es.
2. **Die unterschätzten neuen Primitive** sind **Memory-Kompression** (F3 P0, nicht das Meter)
   und die **Broker-Scope-Erweiterung `cross-project-read`** (F4 P2) — nicht der `@projekt`-Verweis.
   Caveman muss in **beide** Agent-Backends injizieren (native stream-json **und** ACP).
3. **F4 ist die einzige Voll-Trifecta** (private-data × untrusted × Cloud-Egress): zwei Beine
   brechen — Egress-Human-Gate **und** Redaction/kuratierte-Auszüge-Quarantäne. P1 (autonom)
   strikt von P2 (human-gated) durch eine Decision-Gate-Grenze getrennt.

**Drei harte Pflicht-Tests** (Akzeptanz, sonst rottet Security still): Caveman-Negativ-Assert
(Grenz-Flächen tragen den Regelsatz nie) · RTK-Degrade + RTK-nie-im-autoritativen-Pfad ·
Cross-Projekt-Auszug-secret-frei.

**Neue human-gated Einträge (§4-Ergänzung):** Cross-Projekt-Egress an ein externes/Cloud-Modell ·
Auswahl der Cross-Projekt-Quell-Session · erster `.git/info/exclude`-Write pro Repo ·
RTK-Binary-Install. **Decision-Gates (PO):** Ampel-Schwellwerte (%-vom-Context als Default) ·
RTK harte-Dep-vs-Angebot · `.capisco/` persönlich-vs-geteilt-Grenze · Caveman-Grenz-Flächen-Liste.
