/**
 * Broker-gated code-hunk revert (road-to-composer-context-runtime P4).
 *
 * Mirrors {@link BrokerFsWriter}: the working-tree change is discarded ONLY
 * inside `broker.execute` (the audited chokepoint), and the actual git call is
 * the first-party `git` exec primitive — `execFile` with a discrete argv array,
 * never a shell. The path is passed as a standalone `checkout -- <path>` arg,
 * so shell metacharacters in the path cannot inject (test 6).
 *
 * Honesty (§2.3 / test 2): revert discards ONLY the path's working-tree hunk —
 * never a side-effect undo. No worktree → `skipped` with an honest reason,
 * never a fake "reverted".
 */

import type {
  BrokerDecision,
  CapabilityBroker,
  CapabilityRequest,
  PermissionDecision,
  Principal,
  RevertOutcome,
  RevertProvider,
} from "@/contracts";
import { git } from "./git-exec.ts";

/** A revert is HUMAN-initiated (the user clicked the discard glyph). */
const HUMAN: Principal = { id: "human", kind: "human", label: "You" };

/** The git runner — defaults to the first-party `execFile`/argv primitive. */
export type GitRunner = (cwd: string, args: string[]) => Promise<unknown>;

/** Human-in-the-loop gate; defaults to deny-all (a real revert clears it). */
export type RevertResolver = (
  request: CapabilityRequest,
) => Promise<PermissionDecision> | PermissionDecision;

const DENY_ALL: RevertResolver = () => ({ axis: "deny" });

export interface BrokerReverterOptions {
  broker: CapabilityBroker;
  resolvePermission?: RevertResolver;
  /** Git runner (defaults to the real `git` exec). Injected in tests. */
  run?: GitRunner;
  /** Worktree check for the honesty `skipped` path (defaults to `git rev-parse`). */
  isRepo?: (cwd: string) => Promise<boolean>;
}

async function defaultIsRepo(cwd: string): Promise<boolean> {
  try {
    await git(cwd, ["rev-parse", "--is-inside-work-tree"]);
    return true;
  } catch {
    return false;
  }
}

export class BrokerReverter implements RevertProvider {
  readonly #broker: CapabilityBroker;
  readonly #resolve: RevertResolver;
  readonly #run: GitRunner;
  readonly #isRepo: (cwd: string) => Promise<boolean>;

  constructor(opts: BrokerReverterOptions) {
    this.#broker = opts.broker;
    this.#resolve = opts.resolvePermission ?? DENY_ALL;
    this.#run = opts.run ?? ((cwd, args) => git(cwd, args));
    this.#isRepo = opts.isRepo ?? defaultIsRepo;
  }

  async revertPath(cwd: string, path: string): Promise<RevertOutcome> {
    // Honesty: no worktree → skipped, never a fake revert.
    if (!(await this.#isRepo(cwd))) {
      return { status: "skipped", reason: "no worktree — revert unavailable" };
    }

    // A revert mutates the working tree → a `file-write` capability. Human
    // intent (the discard click) is trusted; no `fromUntrusted` flag.
    const request: CapabilityRequest = { kind: "file-write", target: path };

    const decision = this.#broker.authorize(HUMAN, request);
    if (decision.outcome === "deny") {
      return { status: "skipped", reason: `revert denied: ${decision.reason}` };
    }
    let execDecision: BrokerDecision = decision;
    if (decision.outcome === "ask") {
      const human = await this.#resolve(request);
      this.#broker.resolve(HUMAN, request, human);
      if (human.axis === "deny") {
        return { status: "skipped", reason: "revert denied by human gate" };
      }
      execDecision = this.#broker.authorize(HUMAN, request);
      if (execDecision.outcome !== "allow") {
        return { status: "skipped", reason: "revert gate not cleared" };
      }
    }

    // EXECUTE through the chokepoint — the git checkout runs ONLY inside this
    // callback (audit written first), with the single-use grant. argv-array:
    // the path is a discrete `checkout -- <path>` arg, no shell interpolation.
    await this.#broker.execute(
      HUMAN,
      request,
      () => this.#run(cwd, ["checkout", "--", path]),
      { grant: execDecision.grant },
    );
    return { status: "reverted", path };
  }
}
