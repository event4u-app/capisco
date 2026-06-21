/**
 * Broker-gated filesystem WRITE perform adapter (road-to-runnable-dev P2).
 *
 * This is the REAL `perform` side-effect adapter that was previously a no-op
 * stub: an editor Save's disk write happens ONLY inside `broker.execute` — the
 * un-bypassable chokepoint (B4). The flow is identical to {@link AcpSession}'s
 * broker seam, reused for a human-initiated file save:
 *
 *   authorize(file-write)  →  [ask → human-gate resolve]  →  execute(perform)
 *
 * The default grant config marks `file-write` as `ask` (mutating capability,
 * never auto-allow). A Save is a HUMAN-initiated, trusted action, so the
 * resolver clears the `ask` per call; the disk write then runs as the `human`
 * principal inside `broker.execute`, which:
 *   - writes the append-only audit BEFORE the callback runs,
 *   - requires the single-use execution grant `authorize` minted (C3),
 *   - invokes {@link writeTextWrite} (the first-party fs-write primitive).
 *
 * A DENIED write never reaches the primitive — `execute` throws on a missing
 * grant, so no disk change occurs. The integration test pins this: a deny-all
 * resolver leaves the file byte-identical.
 *
 * SECURITY: the write content + path cross the IPC wire (they are the editor
 * buffer the user is saving — not a secret), but the broker EXECUTION runs
 * in-process here, never RPC-fired. Secrets are never involved in an editor
 * save; the execution context's injector is simply unused.
 */

import type {
  BrokerDecision,
  CapabilityBroker,
  CapabilityRequest,
  PermissionDecision,
  Principal,
} from "@/contracts";
import { canonicalRoot, writeTextWrite } from "./fs-write-exec.ts";

/**
 * Human-in-the-loop gate for an editor save. Given the `file-write` request,
 * returns the decision. Defaults to deny-all (fail closed) so a write never
 * fires without an explicit human OK; a real UI passes a resolver that
 * confirms the save (and a dev save is implicitly the human pressing ⌘S).
 */
export type FileWriteResolver = (
  request: CapabilityRequest,
) => Promise<PermissionDecision> | PermissionDecision;

/** Fail-closed default: no write proceeds without an explicit resolver. */
const DENY_ALL: FileWriteResolver = () => ({ axis: "deny" });

/** The human principal a cleared save executes as (§3.1 responsible principal). */
const HUMAN: Principal = { id: "human", kind: "human", label: "You" };

export interface FsWriteBrokerOptions {
  broker: CapabilityBroker;
  /** Human-gate resolver (defaults to deny-all). A Save resolver clears it. */
  resolvePermission?: FileWriteResolver;
}

/**
 * The broker-gated file-write adapter. `write(root, relPath, text)` runs the
 * full authorize → gate → execute path; the disk touch happens ONLY inside
 * `broker.execute`'s callback. Throws if the broker denies (no disk change).
 */
export class BrokerFsWriter {
  readonly #broker: CapabilityBroker;
  readonly #resolve: FileWriteResolver;

  constructor(opts: FsWriteBrokerOptions) {
    this.#broker = opts.broker;
    this.#resolve = opts.resolvePermission ?? DENY_ALL;
  }

  /**
   * Persist `text` to `relPath` under the repo `root` through the broker. The
   * `target` of the capability is the repo-relative path (what the allowlist /
   * audit sees); the write is path-traversal-guarded inside the primitive.
   *
   * A human Save is TRUSTED intent (not untrusted agent/web output), so no
   * `fromUntrusted` flag is set — the lethal-trifecta gate does not apply.
   */
  async write(root: string, relPath: string, text: string): Promise<void> {
    const request: CapabilityRequest = { kind: "file-write", target: relPath };

    // 1. Authorize (writes the append-only audit BEFORE any disk touch). The
    //    default config returns `ask` for file-write.
    const decision = this.#broker.authorize(HUMAN, request);
    if (decision.outcome === "deny") {
      throw new Error(`file write denied: ${relPath} (${decision.reason})`);
    }

    // 2. On `ask`, the human gate decides. A Save resolver clears it per call;
    //    a deny-all resolver leaves the file untouched (no disk change).
    let execDecision: BrokerDecision = decision;
    if (decision.outcome === "ask") {
      const human = await this.#resolve(request);
      if (human.axis === "deny") {
        this.#broker.resolve(HUMAN, request, human);
        throw new Error(`file write denied by human gate: ${relPath}`);
      }
      this.#broker.resolve(HUMAN, request, human);
      // C3 — re-authorize on the human's authority to mint the execution grant
      // `execute` requires (the persisted grant now clears the gate to `allow`).
      execDecision = this.#broker.authorize(HUMAN, request);
      if (execDecision.outcome !== "allow") {
        throw new Error(`file write gate not cleared: ${relPath}`);
      }
    }

    // 3. EXECUTE through the chokepoint — the disk write is the perform side
    //    effect, run ONLY inside this callback, with the single-use grant.
    const absRoot = canonicalRoot(root);
    this.#broker.execute(
      HUMAN,
      request,
      () => writeTextWrite(absRoot, relPath, text),
      { grant: execDecision.grant },
    );
  }
}
