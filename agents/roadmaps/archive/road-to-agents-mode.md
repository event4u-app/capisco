---
status: complete
block: Differenzierer
depends_on: [road-to-chrome-shell, road-to-design-primitives]
unlocks: [road-to-editor]
---

# Road to Agents-Mode (R2) — der Differenzierer

**Goal:** Der agent-native Kern in 100 % Politur — Session-Tabs, Subagent-Row, zentrierte
Chat-Spalte, ToolAction, der **Capability-Broker-Permission-Prompt** (das Signatur-Element),
und der Composer mit Control-Bar (Modell · Effort-Slider · Budget-Ring + Plan-Usage). Hier liegt
die 15 %, die 90 % des Werts ausmachen.

> Referenz: `build-spec.md` §4 + `ui_kits/capisco-ide/agent.jsx` (verbatim-Verhalten).
> **Korrektur (build-plan §3):** Chat-Spalte **zentriert ~740px** (nicht rechts-verschoben).

## Akzeptanz

- DOM-Assert: Session-Tabs (StatusDot/ModelBadge/Title/Meta/Close), Subagent-Chips, zentrierte
  740px-Chat-Spalte, **PermissionPrompt-Block vorhanden** (teal-outline), ComposerBar
  (Modell/Effort/Budget). Broker-Invariante: Secret nie als Wert, nur als Referenz.
- `verify:visual` grün (dark + light) gegen Goldens; **Transkript virtualisiert** (Test mit 500 Msgs).
- Tastatur: Composer-Send (⌘↵), Popover-Fokusfallen, Tab-Order; axe grün; i18n alle Strings.
- Leer-Zustand neuer Session; Lade-/Fehler-Zustand eines Agent-Laufs.
- **Sicht-Abnahme durch Matze** — dies ist die *stärkste* Fidelity-Fläche; ohne OK nicht geschlossen.

## Phase 0 — Session-Tabbar & Subagents

- [x] **Session-Tabs**: StatusDot (running-pulse/idle/waiting/error/done), ModelBadge, Titel,
      `runtime · token`-Meta (mono/grau, maskiert in Goldens), Close-×.
- [x] **`+` New-Session**: Menü „New session with…" (Modell zuerst wählen → Session entsteht).
      **Gear** öffnet Agent-Backend-Settings-Popover.
- [x] **Subagent-Row**: Kind-Agenten als kleine Branch-Chips mit eigenem StatusDot + Meta.
- [x] State gegen `Session`/`SubAgent`-Interfaces (R0), Mock-Provider; create/close/switch.

## Phase 1 — Chat-Transkript (zentriert, virtualisiert)

- [x] **Chat-Inner zentriert in ~740px** Lesespalte (Korrektur gegen Prototyp).
- [x] **`Msg`** (You/agent, optional `who`), Hover-Reveal: retry/copy/branch. Code als mono.
- [x] **`ToolAction`** (aus R0-Primitiv): Verb + mono-Target + `+adds/−dels`, collapsible,
      open-in-editor-Icon → Diff-View (R1). Such-Variante ohne Diffstat.
- [x] **Virtualisierung** des Transkripts; Empty-State („Describe a task to start the agent").

## Phase 2 — Capability-Broker-Permission-Prompt (Signatur)

- [x] **`PermissionPrompt`** (teal-outline, ruhig, nie alarmistisch): Capability in mono
      (`Bash(rm -rf .worktrees/tmp)`), Label „Approval required", Scope-Buttons
      `[Allow once] [This session] [Deny]` (primary/outline/ghost). Aus `PermissionRequest`-Interface.
- [x] **Invariante sichtbar machen:** wenn die Capability ein Secret berührt, wird die Referenz
      gezeigt (`credential: …`), nie der Wert (Overview §2.1). Keine „dauerhaft erlauben"-Option für Prod.

## Phase 3 — Composer & Control-Bar

- [x] **Composer**: `Input` (mono, Placeholder „Message Capisco…"), Send-Pfeil (teal).
- [x] **ComposerBar** (Claude-Desktop-Stil): **Modell-Picker** (Popover), **Effort-Popover**
      (Faster↔Smarter 6-Stufen-Slider), **Budget-Ring** → **Plan-Usage-Popover** (5h/weekly/
      model-specific/credits als Label-Progress-Bars). Live-Status (backend · tokens · cost · runtime).
- [x] **AgentSettings-Popover**: **API client** (Provider + Token-Feld, „stored in your OS
      keychain"-Note) **oder** **Installed CLI** (erkanntes Binary + Pfad). Footer reflektiert Wahl.
      (UI-Shell: Keychain/CLI-Detect sind Mock-Provider hinter Interface.)

## Council-Notizen

- Effort-Slider + Budget-Ring + Plan-Popover sind **composite custom controls** (from-scratch),
  keine Komposition — auf den R0-Primitiven (Popover/Slider/Progress) bauen (Reviewer 2).
- Stärkste Fidelity-Fläche → menschliche Sicht-Abnahme zwingend (Reviewer 3).
- Broker-Prompt ist das Signatur-Element des Produkts — höchste Politur, ruhiger Ton.
