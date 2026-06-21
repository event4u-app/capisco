/**
 * Backend-provisioning wiring (B8 P0/P1).
 *
 * Registers the RPC-safe DETECTION surface (`provision.detect`) on the registry
 * so the AgentSettings UI can read the structured backend catalog over the IPC
 * spine. Detection is read-only (the `which`/`--version` primitive) and carries
 * no secret — it is safe on the wire.
 *
 * The INSTALL action is deliberately NOT on this wire surface in the same shape
 * as detection: an install is a broker-mediated `execute` (the disk/network side
 * effect runs in-process inside `broker.execute`, mirroring the B4/P2 split). The
 * returned {@link BrokerInstaller} is the in-process handle a UI install action
 * drives; only its non-secret {@link InstallOutcome} crosses back. We expose a
 * thin `install` RPC method that delegates to the broker-gated installer so the
 * UI can trigger it, but the gate + execution remain inside the chokepoint.
 */

import type { CapabilityBroker, InstallOutcome } from "@/contracts";
import type { ProviderRegistry } from "./registry/registry.ts";
import {
  RealBackendProvisioner,
  type BackendProvisionerOptions,
} from "./provision/backend-provisioner.ts";
import {
  BrokerInstaller,
  type InstallResolver,
  type InstallRunner,
} from "./provision/install-broker.ts";

/** The provisioner provider id on the wire (detection + install trigger). */
export const PROVISION_PROVIDER_ID = "provision";

export interface RegisterProvisionOptions extends BackendProvisionerOptions {
  /**
   * The capability broker (B4). When given, the `install` method is broker-gated
   * through it; absent, an install attempt reports gated (no command runs).
   */
  broker?: CapabilityBroker;
  /** Human-gate resolver for installs (defaults to deny-all, fail-closed). */
  resolveInstall?: InstallResolver;
  /** Install runner override (tests inject a DRY/echo runner). */
  installRunner?: InstallRunner;
}

/**
 * The RPC-facing provision provider. `detect` returns the read-only catalog;
 * `install` triggers the broker-gated installer for an exact argv (never
 * silent — the broker writes the audit and the human gate decides).
 */
export class ProvisionProvider {
  readonly #provisioner: RealBackendProvisioner;
  readonly #installer?: BrokerInstaller;

  constructor(provisioner: RealBackendProvisioner, installer?: BrokerInstaller) {
    this.#provisioner = provisioner;
    this.#installer = installer;
  }

  detect(): Promise<import("@/contracts").AgentBackend[]> {
    return this.#provisioner.detect();
  }

  /**
   * Install via the broker-gated path. The `argv` is the EXACT command (the
   * detected backend's `installCommand`). Without a broker wired, the attempt is
   * reported gated — never a silent install.
   */
  install(argv: readonly string[]): Promise<InstallOutcome> {
    if (!this.#installer) {
      return Promise.resolve({
        installed: false,
        reason: "no broker wired — install is unavailable",
        auditedTarget: argv.join(" "),
      });
    }
    return this.#installer.install(argv);
  }
}

/**
 * Register the provision provider (detection + broker-gated install). Returns the
 * provider + the in-process installer handle. Idempotent only on a fresh
 * registry (uses `register`, which throws on a duplicate id).
 */
export function registerProvision(
  registry: ProviderRegistry,
  opts: RegisterProvisionOptions = {},
): { provider: ProvisionProvider; installer?: BrokerInstaller } {
  const provisioner = new RealBackendProvisioner({
    probe: opts.probe,
    includeOptional: opts.includeOptional,
  });
  const installer = opts.broker
    ? new BrokerInstaller({
        broker: opts.broker,
        resolvePermission: opts.resolveInstall,
        runner: opts.installRunner,
      })
    : undefined;
  const provider = new ProvisionProvider(provisioner, installer);
  registry.register(PROVISION_PROVIDER_ID, provider as never);
  return { provider, installer };
}
