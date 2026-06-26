/**
 * Agent-provisioning contracts (B8, road-to-agent-provisioning P0/P1).
 *
 * The IDE detects agent tooling on the host (read-only), helps install what is
 * missing (broker-gated, human-approved, NEVER silent), and surfaces a
 * structured backend catalog so the AgentSettings UI can offer a low-friction
 * "install / use" flow.
 *
 * Two Claude Code backends are modelled (extensible to Codex/Gemini):
 *  - a NATIVE adapter driving `claude` stream-json directly (uses the existing
 *    Claude login — no raw key), and
 *  - the `@zed-industries/claude-code-acp` ACP bridge driving the existing ACP
 *    adapter.
 *
 * SECURITY: detection is a read-only `which`/`--version` probe (the audited
 * detect primitive). An INSTALL is consequential shell egress — it flows through
 * the capability broker (`authorize` → human-gate → `execute`), append-only
 * audited, never auto. None of these shapes carry a secret value.
 */

/**
 * The lifecycle status of one detected backend:
 *  - `ready`       — the backend is installed + runnable right now.
 *  - `installable` — missing, but the IDE can install it via a known command
 *    (broker-gated, human-approved). `installCommand` is present.
 *  - `guide`       — missing and NOT auto-installable (heavy / unsupported, e.g.
 *    the Claude CLI itself, which carries a login) — surface a guided step +
 *    `guideUrl` instead of an auto-install.
 */
export type AgentBackendStatus = "ready" | "installable" | "guide";

/**
 * How a backend is driven once ready. `native-stream-json` is the direct
 * `claude -p --output-format=stream-json` adapter; `acp-bridge` is the
 * `claude-code-acp` ACP path; `prerequisite` is a tooling prerequisite (node /
 * npm / npx) that other backends depend on, surfaced for diagnosability.
 */
export type AgentBackendDriver = "native-stream-json" | "acp-bridge" | "prerequisite";

/**
 * One detected (or detectable) agent backend in the catalog. Every field is
 * non-secret and safe to serialize over the wire / log / display.
 */
export interface AgentBackend {
  /** Stable id (e.g. `claude-native`, `claude-code-acp`, `node`, `codex`). */
  id: string;
  /** Display label (e.g. "Claude Code (native)", "Claude Code (via ACP)"). */
  label: string;
  driver: AgentBackendDriver;
  status: AgentBackendStatus;
  /**
   * The resolved binary path when `ready` (the `which` result) — never a
   * secret. Absent when missing.
   */
  detail?: string;
  /** Detected version string when known (`--version` output, trimmed). */
  version?: string;
  /**
   * The EXACT install command for an `installable` backend — the argv the
   * broker-gated installer authorizes + runs (e.g.
   * `["npm","i","-g","@zed-industries/claude-code-acp"]`). Present only when
   * `status === "installable"`. Never interpolated into a shell string.
   */
  installCommand?: string[];
  /** A guidance URL for a `guide` backend (manual install / login). */
  guideUrl?: string;
  /**
   * The ids this backend depends on (e.g. the ACP bridge depends on `node`/`npm`
   * and on the `claude` login). Surfaced so the UI can explain a blocked setup.
   */
  requires?: string[];
}

/**
 * The outcome of a broker-gated install attempt. `installed` is true only when
 * the broker cleared the capability AND the command succeeded; otherwise the
 * attempt was `gated` (human denied / fail-closed) or the command failed — never
 * a silent success. `auditedTarget` is the command target the broker recorded.
 */
export interface InstallOutcome {
  installed: boolean;
  /** Why it did not install (gate denied / command failed). Absent on success. */
  reason?: string;
  /** The command target the broker audited (the joined argv). Never a secret. */
  auditedTarget: string;
}

/**
 * Read-only backend detection + the catalog builder. The provisioner NEVER
 * installs — it only probes the host with read-only `which`/`--version` calls
 * and returns the structured catalog. The install action lives behind the broker
 * (see the install adapter), not on this read-only surface.
 */
export interface BackendProvisioner {
  /**
   * Detect every known backend on the host (read-only) and return the catalog
   * with per-backend status + install command / guide URL.
   */
  detect(): Promise<AgentBackend[]>;
}

/**
 * Runtime agent-backend selection (road-to-actually-works P2). The picker UI
 * drives `detect` → `select`; the composer bar reads `current()` (the REAL
 * selected backend, never the mock "API"); `cost()` turns real token telemetry
 * into USD. Backed by {@link BackendSelection} in the sidecar; a deterministic
 * mock fallback serves the browser-only path.
 */
export interface AgentBackendProvider {
  detect(): Promise<AgentBackend[]>;
  /** Select the active backend by id; returns its config. Rejects if not ready. */
  select(id: string): Promise<import("./agents").BackendConfig>;
  /** The active backend as a BackendConfig — the composer bar's real label. */
  current(): Promise<import("./agents").BackendConfig>;
  /** USD cost from cumulative token telemetry for a model. */
  cost(model: string, telemetry: import("./agents").Telemetry): Promise<number>;
}
