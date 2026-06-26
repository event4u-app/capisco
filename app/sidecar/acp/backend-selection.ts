/**
 * Runtime agent-backend selection + cost (road-to-actually-works P2).
 *
 * Today the backend is fixed at boot (CAPISCO_AGENT_BACKEND env) and the UI
 * shows the deterministic MOCK catalog — which is why the composer bar "always
 * says API". This holder makes the selection a runtime fact the UI drives:
 *  - detect()  → the REAL detected catalog (delegates to the provisioner)
 *  - select(id)→ set the active backend (validated against detected + ready)
 *  - current() → the active backend as a BackendConfig (the bar's real label)
 *  - runConfig()→ how a chat run should spawn for the active backend
 *  - cost()    → USD from real token telemetry (no more mock "$0.04")
 *
 * It is plain, deterministic, unit-testable infrastructure; the wire surface
 * (`agent-backend` provider) and the live-agent-provider read through it.
 */

import type { AgentBackend, BackendConfig, Telemetry } from "@/contracts";

export interface BackendDetector {
  detect(): Promise<AgentBackend[]>;
}

/** USD per 1M tokens (in / out). Manually maintained; widened by family fallback. */
export interface ModelPricing {
  readonly inPerMtok: number;
  readonly outPerMtok: number;
}

const PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-8": { inPerMtok: 15, outPerMtok: 75 },
  "claude-opus-4-5": { inPerMtok: 15, outPerMtok: 75 },
  "claude-sonnet-4-5": { inPerMtok: 3, outPerMtok: 15 },
  "claude-haiku-4-5": { inPerMtok: 0.8, outPerMtok: 4 },
};

/** Family fallback so an unlisted point-release still prices instead of $0. */
function familyPricing(model: string): ModelPricing | undefined {
  const m = model.toLowerCase();
  if (m.includes("opus")) return { inPerMtok: 15, outPerMtok: 75 };
  if (m.includes("sonnet")) return { inPerMtok: 3, outPerMtok: 15 };
  if (m.includes("haiku")) return { inPerMtok: 0.8, outPerMtok: 4 };
  if (m.includes("gpt-5") || m.includes("codex")) return { inPerMtok: 1.25, outPerMtok: 10 };
  if (m.includes("gemini")) return { inPerMtok: 1.25, outPerMtok: 5 };
  return undefined;
}

/** Compute USD cost from cumulative token telemetry. Unknown model → 0 (honest). */
export function costUsd(model: string, t: Telemetry): number {
  const p = PRICING[model] ?? familyPricing(model);
  if (!p) return 0;
  return (t.tokensIn * p.inPerMtok + t.tokensOut * p.outPerMtok) / 1_000_000;
}

/** How a chat run should spawn for a given backend. */
export interface BackendRunConfig {
  driver: AgentBackend["driver"];
  /** Spawn command + args for the acp-bridge path; absent for native/stub/prereq. */
  command?: string;
  args?: string[];
}

export class BackendSelection {
  readonly #detector: BackendDetector;
  #detected: AgentBackend[] = [];
  #selectedId: string | undefined;

  constructor(detector: BackendDetector, defaultId?: string) {
    this.#detector = detector;
    this.#selectedId = defaultId;
  }

  async detect(): Promise<AgentBackend[]> {
    this.#detected = await this.#detector.detect();
    // If nothing is selected yet, default to the first READY backend.
    if (this.#selectedId === undefined) {
      this.#selectedId = this.#detected.find((b) => b.status === "ready")?.id;
    }
    return this.#detected;
  }

  /** Set the active backend. Throws on an unknown id or a non-ready backend. */
  select(id: string): void {
    const found = this.#detected.find((b) => b.id === id);
    if (!found) throw new Error(`unknown backend "${id}" — run detect() first`);
    if (found.status !== "ready") {
      throw new Error(`backend "${id}" is ${found.status}, not ready — install/login first`);
    }
    this.#selectedId = id;
  }

  selectedId(): string | undefined {
    return this.#selectedId;
  }

  selectedBackend(): AgentBackend | undefined {
    return this.#detected.find((b) => b.id === this.#selectedId);
  }

  /** The active backend as a BackendConfig — the REAL label for the composer bar. */
  current(): BackendConfig {
    const b = this.selectedBackend();
    if (!b) return { kind: "cli", provider: "no backend", detail: "run detect()" };
    const versioned = b.version ? `${b.label} ${b.version}` : b.label;
    return { kind: b.driver === "prerequisite" ? "api" : "cli", provider: versioned, detail: b.detail };
  }

  /** How a chat run should spawn for the active backend. */
  runConfig(): BackendRunConfig {
    const b = this.selectedBackend();
    if (!b) return { driver: "prerequisite" };
    if (b.driver === "acp-bridge") {
      // The bridge runs via its resolved binary (or npx fallback); the live
      // provider passes these to the AcpSession transport.
      const command = b.detail ?? "npx";
      const args = b.detail ? [] : ["-y", "@zed-industries/claude-code-acp"];
      return { driver: "acp-bridge", command, args };
    }
    return { driver: b.driver };
  }

  cost(model: string, telemetry: Telemetry): number {
    return costUsd(model, telemetry);
  }
}
