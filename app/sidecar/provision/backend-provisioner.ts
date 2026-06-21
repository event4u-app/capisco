/**
 * BackendProvisioner (B8 P0) — read-only host detection + the structured agent
 * backend catalog.
 *
 * It probes the host with the read-only `which`/`--version` primitive
 * (`detect-exec.ts`) and returns `AgentBackend[]` with per-backend status:
 *  - prerequisites (node/npm/npx) → `ready` | `guide` (a missing runtime is a
 *    guided install, never auto — installing node is out of our remit),
 *  - `claude` native stream-json adapter → `ready` when the CLI resolves, else
 *    `guide` (the Claude CLI carries a login; we never auto-install it),
 *  - `@zed-industries/claude-code-acp` ACP bridge → `ready` when resolvable
 *    (global bin OR an installed local copy), else `installable` via
 *    `npm i -g …` (the broker-gated install path),
 *  - optional `codex` / `gemini` → `ready` when present, else omitted unless
 *    asked (they are not core to the Claude flow).
 *
 * NO INSTALL happens here. This surface is pure detection; the install action is
 * a separate broker-gated capability (`install-broker.ts`).
 */

import type { AgentBackend, BackendProvisioner } from "@/contracts";
import { probeVersion, resolveBinaryPath } from "./detect-exec.ts";

/** The npm package the ACP bridge ships as. */
export const ACP_BRIDGE_PACKAGE = "@zed-industries/claude-code-acp";

/** The exact, never-interpolated install argv for the ACP bridge. */
export const ACP_BRIDGE_INSTALL_COMMAND: readonly string[] = [
  "npm",
  "i",
  "-g",
  ACP_BRIDGE_PACKAGE,
];

/** Guidance URLs for `guide`-status backends (manual install / login). */
const GUIDE_URLS = {
  node: "https://nodejs.org/en/download",
  claude: "https://docs.claude.com/en/docs/claude-code/overview",
} as const;

/**
 * Injectable host probes — defaulted to the real read-only primitive. Tests pass
 * a fake table so detection is hermetic (no real `which`/spawn). The probe
 * resolves a binary path (or undefined) and reads a version (or undefined).
 */
export interface HostProbe {
  resolve(command: string): string | undefined;
  version(command: string, args?: string[]): Promise<string | undefined>;
}

export const realHostProbe: HostProbe = {
  resolve: (command) => resolveBinaryPath(command),
  version: (command, args) => probeVersion(command, args),
};

export interface BackendProvisionerOptions {
  probe?: HostProbe;
  /** Include the optional codex/gemini backends in the catalog. Default false. */
  includeOptional?: boolean;
}

export class RealBackendProvisioner implements BackendProvisioner {
  readonly #probe: HostProbe;
  readonly #includeOptional: boolean;

  constructor(opts: BackendProvisionerOptions = {}) {
    this.#probe = opts.probe ?? realHostProbe;
    this.#includeOptional = opts.includeOptional ?? false;
  }

  async detect(): Promise<AgentBackend[]> {
    const out: AgentBackend[] = [];

    // --- Prerequisites: node / npm / npx ------------------------------------
    // A missing runtime is a guided install (installing node is out of remit).
    const node = await this.#prereq("node", "Node.js", GUIDE_URLS.node);
    const npm = await this.#prereq("npm", "npm", GUIDE_URLS.node);
    const npx = await this.#prereq("npx", "npx", GUIDE_URLS.node);
    out.push(node, npm, npx);

    const npmReady = npm.status === "ready";

    // --- Native Claude Code (option 2a): claude stream-json -----------------
    // The CLI carries the user's Claude login → we NEVER auto-install it. Ready
    // when it resolves on disk; otherwise a guided step + link.
    const claudePath = this.#probe.resolve("claude");
    const claudeVersion = claudePath ? await this.#probe.version("claude", ["--version"]) : undefined;
    out.push({
      id: "claude-native",
      label: "Claude Code (native)",
      driver: "native-stream-json",
      status: claudePath ? "ready" : "guide",
      detail: claudePath,
      version: claudeVersion,
      guideUrl: claudePath ? undefined : GUIDE_URLS.claude,
      requires: ["claude"],
    });

    // --- ACP bridge (option 2b): @zed-industries/claude-code-acp ------------
    // Ready when the bridge bin resolves (a global install puts it on PATH).
    // Otherwise installable via `npm i -g …` — but only when npm is present;
    // without npm it is a guided step (install node/npm first).
    const bridgePath = this.#probe.resolve("claude-code-acp");
    const bridgeVersion = bridgePath
      ? await this.#probe.version("claude-code-acp", ["--version"])
      : undefined;
    out.push({
      id: "claude-code-acp",
      label: "Claude Code (via ACP)",
      driver: "acp-bridge",
      status: bridgePath ? "ready" : npmReady ? "installable" : "guide",
      detail: bridgePath,
      version: bridgeVersion,
      installCommand: bridgePath || !npmReady ? undefined : [...ACP_BRIDGE_INSTALL_COMMAND],
      guideUrl: bridgePath || npmReady ? undefined : GUIDE_URLS.node,
      // The bridge drives the existing `claude` login, so it depends on it.
      requires: ["npm", "claude"],
    });

    // --- Optional ACP agents: codex / gemini --------------------------------
    if (this.#includeOptional) {
      out.push(await this.#optional("codex", "Codex (via ACP)"));
      out.push(await this.#optional("gemini", "Gemini (via ACP)"));
    }

    return out;
  }

  /** A runtime prerequisite — ready when present, else a guided install. */
  async #prereq(command: string, label: string, guideUrl: string): Promise<AgentBackend> {
    const path = this.#probe.resolve(command);
    const version = path ? await this.#probe.version(command, ["--version"]) : undefined;
    return {
      id: command,
      label,
      driver: "prerequisite",
      status: path ? "ready" : "guide",
      detail: path,
      version,
      guideUrl: path ? undefined : guideUrl,
    };
  }

  /** An optional ACP agent CLI — ready when present, else still `guide`. */
  async #optional(command: string, label: string): Promise<AgentBackend> {
    const path = this.#probe.resolve(command);
    const version = path ? await this.#probe.version(command, ["--version"]) : undefined;
    return {
      id: command,
      label,
      driver: "acp-bridge",
      status: path ? "ready" : "guide",
      detail: path,
      version,
      guideUrl: path ? undefined : GUIDE_URLS.claude,
      requires: [command],
    };
  }
}
