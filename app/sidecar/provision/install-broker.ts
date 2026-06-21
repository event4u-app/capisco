/**
 * Broker-gated agent-tooling installer (B8 P1).
 *
 * An install is CONSEQUENTIAL shell egress — it must flow through the broker
 * chokepoint, append-only audited, with an explicit human gate. NEVER silent,
 * NEVER auto. The flow is identical to {@link BrokerFsWriter}'s seam, reused for
 * an install:
 *
 *   authorize(shell, "<argv joined>")  →  [ask → human-gate resolve]  →  execute(perform = runInstall)
 *
 * The default grant config marks `npm i -g …` (and installs generally) as `ask`
 * — a mutating capability, never auto-allow. The human clears the gate per call
 * (the IDE surfaces the EXACT command); the install command then runs as the
 * `human` principal inside `broker.execute`, which:
 *   - writes the append-only audit BEFORE the command runs,
 *   - requires the single-use execution grant `authorize` minted (C3),
 *   - invokes {@link runInstall} (the first-party install primitive).
 *
 * A DENIED install never reaches the primitive — `execute` throws on a missing
 * grant, so nothing is installed. The integration test pins this.
 *
 * AUTONOMY / VERIFICATION: the real (network/global) install is the user's
 * broker-approved go. The build verifies this path with a DRY/echo command
 * (`commandOverride`) — no real install. A real deployment passes the detected
 * backend's `installCommand` and a resolver that confirms with the human.
 *
 * SECURITY: an install command is HUMAN-initiated trusted intent (the user
 * clicked "install this exact command"), so no `fromUntrusted` flag is set — the
 * lethal-trifecta gate does not apply. The command is the literal detected argv,
 * not derived from untrusted agent/web output. No secret is involved (the bridge
 * uses the existing Claude login).
 */

import type {
  BrokerDecision,
  CapabilityBroker,
  CapabilityRequest,
  InstallOutcome,
  PermissionDecision,
  Principal,
} from "@/contracts";
import { runInstall, type InstallExecResult } from "./install-exec.ts";

/**
 * Human-in-the-loop gate for an install. Given the `shell` request (whose
 * `target` is the exact command), returns the decision. Defaults to deny-all
 * (fail closed) so an install never fires without an explicit human OK; a real
 * UI passes a resolver that confirms the exact command.
 */
export type InstallResolver = (
  request: CapabilityRequest,
) => Promise<PermissionDecision> | PermissionDecision;

/** Fail-closed default: no install proceeds without an explicit resolver. */
const DENY_ALL: InstallResolver = () => ({ axis: "deny" });

/** The human principal a cleared install executes as (§3.1 responsible principal). */
const HUMAN: Principal = { id: "human", kind: "human", label: "You" };

/** A pluggable runner — defaults to the real install primitive. Tests inject. */
export type InstallRunner = (
  argv: readonly string[],
) => Promise<InstallExecResult>;

export interface InstallBrokerOptions {
  broker: CapabilityBroker;
  /** Human-gate resolver (defaults to deny-all). The IDE clears it per call. */
  resolvePermission?: InstallResolver;
  /** Install runner (defaults to {@link runInstall}). Tests inject a fake. */
  runner?: InstallRunner;
}

/** Join an argv into the audited command target — never re-parsed as a shell. */
export function installTarget(argv: readonly string[]): string {
  return argv.join(" ");
}

/**
 * The broker-gated installer. `install(argv)` runs the full
 * authorize → gate → execute path; the install command runs ONLY inside
 * `broker.execute`'s callback. Returns an {@link InstallOutcome} — `installed`
 * is true only on a cleared gate AND a successful command; a gated/denied
 * attempt or a failed command is `installed:false` with a reason (never a silent
 * success). Verify the wiring with a DRY/echo `argv` (e.g.
 * `["echo","npm","i","-g",pkg]`) — no real install.
 */
export class BrokerInstaller {
  readonly #broker: CapabilityBroker;
  readonly #resolve: InstallResolver;
  readonly #run: InstallRunner;

  constructor(opts: InstallBrokerOptions) {
    this.#broker = opts.broker;
    this.#resolve = opts.resolvePermission ?? DENY_ALL;
    this.#run = opts.runner ?? runInstall;
  }

  async install(argv: readonly string[]): Promise<InstallOutcome> {
    if (argv.length === 0) {
      return { installed: false, reason: "empty install command", auditedTarget: "" };
    }
    const target = installTarget(argv);
    // A `shell` capability whose target is the EXACT install command. Trusted
    // human intent (the user picked this command) — no `fromUntrusted`.
    const request: CapabilityRequest = { kind: "shell", target };

    // 1. Authorize (writes the append-only audit BEFORE any command runs). The
    //    default config returns `ask` for an install command.
    const decision = this.#broker.authorize(HUMAN, request);
    if (decision.outcome === "deny") {
      return { installed: false, reason: `install denied: ${decision.reason}`, auditedTarget: target };
    }

    // 2. On `ask`, the human gate decides. A confirm resolver clears it per call;
    //    a deny-all resolver leaves nothing installed (no command runs).
    let execDecision: BrokerDecision = decision;
    if (decision.outcome === "ask") {
      const human = await this.#resolve(request);
      this.#broker.resolve(HUMAN, request, human);
      if (human.axis === "deny") {
        return { installed: false, reason: "install denied by human gate", auditedTarget: target };
      }
      // C3 — re-authorize on the human's authority to mint the execution grant
      // `execute` requires (the persisted grant now clears the gate to `allow`).
      execDecision = this.#broker.authorize(HUMAN, request);
      if (execDecision.outcome !== "allow") {
        return { installed: false, reason: "install gate not cleared", auditedTarget: target };
      }
    }

    // 3. EXECUTE through the chokepoint — the install command is the perform side
    //    effect, run ONLY inside this callback, with the single-use grant. The
    //    `execute` callback returns a promise the broker hands back.
    const result = await this.#broker.execute(
      HUMAN,
      request,
      () => this.#run(argv),
      { grant: execDecision.grant },
    );

    if (!result.ok) {
      return {
        installed: false,
        reason: `install command failed (${result.code ?? "signal"}): ${result.stderr.trim().slice(0, 200)}`,
        auditedTarget: target,
      };
    }
    return { installed: true, auditedTarget: target };
  }
}
