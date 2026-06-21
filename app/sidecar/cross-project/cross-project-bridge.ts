/**
 * {@link CrossProjectBridge} impl (road-to-cross-project-knowledge P2) — the
 * full lethal-trifecta surface, with TWO legs deliberately broken.
 *
 * Composes:
 *  - A per-project store FEDERATION (the persistent, cross-project-readable
 *    store prerequisite) — keyed by the recent-projects absolute path. The
 *    shipped impl holds in-memory fakes per project; the real swap is a
 *    disk-backed {@link SessionStore} per root behind the same contract.
 *  - The redaction stage (`redact-excerpt.ts`) — QUARANTINE leg (AK-C1 + AK-C2).
 *  - The {@link CapabilityBroker} — the new `cross-project-read` scope (AK-C4,
 *    fail-closed) AND the egress human-gate (AK-C3).
 *
 * The two legs (so a single bypass cannot leak A's context to a cloud model):
 *
 *  1. **Read gate (AK-C4).** `searchProject` / `curateFromSession` authorize a
 *     `cross-project-read` capability scoped to the source project. The default
 *     config has NO allow rule for it → fail-closed `ask`. Until a human grants
 *     the read for that project, the bridge returns NO excerpts. Human-driven
 *     relevance (AK-C5): the caller names the source project + session; there is
 *     no auto-fan-out across projects.
 *  2. **Quarantine (AK-C1 + AK-C2).** Every block that survives the read gate is
 *     passed through `redactToExcerpt`: a value-shaped secret is REFUSED (the
 *     block is dropped, never crosses), and a clean block is reduced to a short
 *     curated snippet — never the full transcript.
 *  3. **Egress gate (AK-C3).** `injectIntoPrompt` is `network` + `fromUntrusted`
 *     → the broker forces `ask`, never auto, never pre-clearable by a
 *     session/scoped grant. Only a per-call human decision sends it; otherwise
 *     `gated` and nothing leaves the machine. Laundered exactly like
 *     `TicketLifecycleImpl` (human becomes the responsible principal over a
 *     trusted request).
 *
 * AK-C6 — knowledge ≠ access: this bridge ONLY reads session text and curates
 * snippets. It holds no worktree / fs / shell / container handle for the source
 * project; no method can trigger an operation on A's files. The output type is
 * a {@link CrossProjectExcerpt} (text), never an executable handle.
 *
 * Deterministic: no Date.now / Math.random; the stores carry their own ordering.
 * The actual cloud send is `performEgress` (default no-op) — the real adapter
 * does the HTTP there, with any token injected at the execution layer via
 * `ctx.withSecret`, never on the wire / in the prompt.
 */

import type {
  CapabilityBroker,
  CapabilityRequest,
  CrossProjectBridge,
  CrossProjectEgressOutcome,
  CrossProjectExcerpt,
  PermissionDecision,
  Principal,
  ProjectStoreEntry,
  TranscriptBlock,
} from "@/contracts";
import { redactToExcerpt } from "./redact-excerpt.ts";

/** The full searchable body of a block — message body or tool target/command. */
function blockBody(block: TranscriptBlock): string {
  switch (block.type) {
    case "message":
      return block.block.body;
    case "tool":
      return `${block.block.kind} ${block.block.target}`;
    case "permission":
      return `${block.block.command} ${block.block.label}`;
  }
}

/**
 * The persistent, cross-project-readable store FEDERATION (the P2 prerequisite).
 * Today the session store is per-store / in-memory; cross-project read needs a
 * store that is persistent AND readable across project roots. This federation
 * is that seam: a path-keyed set of {@link SessionStore}s, one per project root
 * (the recent-projects absolute path). The shipped impl holds the in-memory
 * fakes the build hermetically tests against; the real swap is a disk-backed
 * (SQLite / content-addressed) store per root behind the SAME contract — a thin
 * provider swap, no bridge change. This factory just collects them; it never
 * crosses the read gate itself (the bridge does, per call).
 */
export function createProjectStoreFederation(
  entries: ProjectStoreEntry[],
): ProjectStoreEntry[] {
  // Defensive copy so a later mutation of the caller's array can't add a
  // project to the federation behind the bridge's back.
  return entries.map((e) => ({ ...e }));
}

/**
 * Per-call human resolver for the cloud egress (AK-C3). Given the broker's
 * `ask`, returns a decision. Defaults to deny-all (fail closed) — the live
 * cross-project cloud egress stays a deferred, explicit user go.
 */
export type EgressResolver = (
  request: CapabilityRequest,
  context: { cloudTarget: string; excerptCount: number },
) => Promise<PermissionDecision> | PermissionDecision;

/**
 * Per-call human resolver for the cross-project READ scope (AK-C4). Defaults to
 * deny-all — the read is fail-closed until a human authorizes it for that
 * project. (This is the "pull from THIS A-session" confirmation, AK-C5.)
 */
export type ReadResolver = (
  request: CapabilityRequest,
  context: { sourceProjectPath: string; sourceProjectName: string },
) => Promise<PermissionDecision> | PermissionDecision;

/** The actual cloud send (real adapter); default no-op (nothing leaves). */
export type PerformEgress = (input: {
  cloudTarget: string;
  excerpts: CrossProjectExcerpt[];
}) => void;

export interface CrossProjectBridgeOptions {
  /** The per-project store federation (path-keyed). */
  projects: ProjectStoreEntry[];
  broker: CapabilityBroker;
  /** Human gate for the cross-project read scope (AK-C4). Default deny-all. */
  resolveRead?: ReadResolver;
  /** Human gate for the cloud egress (AK-C3). Default deny-all. */
  resolveEgress?: EgressResolver;
  /** The cloud send side effect (real adapter). Default no-op. */
  performEgress?: PerformEgress;
}

const DENY_ALL_READ: ReadResolver = () => ({ axis: "deny" });
const DENY_ALL_EGRESS: EgressResolver = () => ({ axis: "deny" });

/** The bridge acts as an agent principal — its read/egress is untrusted. */
const BRIDGE: Principal = { id: "cross-project-bridge", kind: "agent", label: "Cross-project bridge" };
const HUMAN: Principal = { id: "human", kind: "human", label: "You" };

export class CrossProjectBridgeImpl implements CrossProjectBridge {
  readonly #projects = new Map<string, ProjectStoreEntry>();
  readonly #broker: CapabilityBroker;
  readonly #resolveRead: ReadResolver;
  readonly #resolveEgress: EgressResolver;
  readonly #performEgress: PerformEgress;

  constructor(opts: CrossProjectBridgeOptions) {
    for (const p of opts.projects) this.#projects.set(p.path, p);
    this.#broker = opts.broker;
    this.#resolveRead = opts.resolveRead ?? DENY_ALL_READ;
    this.#resolveEgress = opts.resolveEgress ?? DENY_ALL_EGRESS;
    this.#performEgress = opts.performEgress ?? (() => {});
  }

  async searchProject(
    sourceProjectPath: string,
    query: string,
  ): Promise<{ authorized: boolean; excerpts: CrossProjectExcerpt[]; reason: string }> {
    const entry = this.#projects.get(sourceProjectPath);
    if (!entry) {
      return { authorized: false, excerpts: [], reason: `unknown source project: ${sourceProjectPath}` };
    }
    // 1. READ GATE (AK-C4). `cross-project-read` is fail-closed: the default
    //    config has no allow rule → `ask`. Authorize as the BRIDGE (agent) —
    //    this writes the append-only audit BEFORE any read.
    const request: CapabilityRequest = {
      kind: "cross-project-read",
      target: sourceProjectPath,
    };
    const decision = this.#broker.authorize(BRIDGE, request, sourceProjectPath);
    let authorized = decision.outcome === "allow";
    let reason = decision.reason;
    if (decision.outcome === "ask") {
      // Per-call human relevance decision (AK-C5). Fail-closed default deny.
      const human = await this.#resolveRead(request, {
        sourceProjectPath,
        sourceProjectName: entry.name,
      });
      this.#broker.resolve(BRIDGE, request, human, sourceProjectPath);
      authorized = human.axis !== "deny";
      reason = authorized ? "human-authorized cross-project read" : "read denied (fail-closed)";
    }
    if (!authorized) return { authorized: false, excerpts: [], reason };

    // 2. QUARANTINE (AK-C1 + AK-C2). Search the foreign store; redact each hit
    //    into a curated excerpt, DROPPING any block that carries a secret.
    const excerpts = await this.#curate(entry, query);
    return { authorized: true, excerpts, reason };
  }

  async curateFromSession(
    sourceProjectPath: string,
    sessionId: string,
    query: string,
  ): Promise<CrossProjectExcerpt[]> {
    // AK-C5 — explicit single named source session. Still passes the read gate.
    const result = await this.searchProject(sourceProjectPath, query);
    if (!result.authorized) return [];
    return result.excerpts.filter((e) => e.sessionId === sessionId);
  }

  async injectIntoPrompt(
    excerpts: CrossProjectExcerpt[],
    cloudTarget: string,
  ): Promise<CrossProjectEgressOutcome> {
    // 3. EGRESS GATE (AK-C3) — A-context → B's cloud prompt. `network` egress
    //    DERIVED FROM UNTRUSTED output (A's agent session). The broker forces
    //    `ask`; a session/scoped grant can NOT pre-clear it (MUST-NOT 4).
    const request: CapabilityRequest = {
      kind: "network",
      target: cloudTarget,
      fromUntrusted: true,
    };
    // Authorize as the BRIDGE (agent) — audited BEFORE any send. Untrusted
    // egress can never auto-allow here.
    const decision = this.#broker.authorize(BRIDGE, request);
    if (decision.outcome === "deny") return { status: "gated", reason: decision.reason };
    if (decision.outcome === "allow") {
      // The broker must never allow untrusted egress outright — refuse rather
      // than auto-send (defence in depth).
      return { status: "gated", reason: "refusing auto-allowed untrusted egress (defence in depth)" };
    }

    // Per-call human decision — the ONLY thing that clears the cloud gate. The
    // live cross-project cloud egress stays a deferred, explicit user go.
    const human = await this.#resolveEgress(request, { cloudTarget, excerptCount: excerpts.length });
    if (human.axis === "deny") {
      this.#broker.resolve(BRIDGE, request, human);
      return { status: "gated", reason: "egress denied (fail-closed)" };
    }

    // The human vetted THIS send and accepts responsibility (§3.1). Execute as
    // the HUMAN principal over a TRUSTED request (no `fromUntrusted`).
    const trusted: CapabilityRequest = { kind: request.kind, target: request.target };
    this.#broker.resolve(HUMAN, trusted, human);
    const grantDecision = this.#broker.authorize(HUMAN, trusted);
    if (grantDecision.outcome !== "allow") return { status: "gated", reason: "human grant did not clear" };
    try {
      this.#broker.execute(
        HUMAN,
        trusted,
        () => {
          // Defence in depth: never send a block that carries a secret, even if
          // a caller hand-built the excerpt list (the curate path already drops
          // them; this is the last line before the wire).
          this.#performEgress({ cloudTarget, excerpts });
        },
        { grant: grantDecision.grant },
      );
    } catch (err) {
      return {
        status: "gated",
        reason: err instanceof Error ? err.message : "egress execution refused",
      };
    }
    return { status: "sent", excerpts };
  }

  /**
   * Search one project's store, redact the FULL matching block body, drop any
   * secret-carrying block. Redaction runs on the full block body (resumed from
   * the store), NOT the store's pre-truncated search snippet — a snippet window
   * could otherwise exclude the `=`/`:` of a secret and leak the value. AK-C1
   * (refuse secrets) decides on the whole body; AK-C2 (curated) cuts the window
   * only AFTER the block clears the secret check.
   */
  async #curate(entry: ProjectStoreEntry, query: string): Promise<CrossProjectExcerpt[]> {
    const hits = await entry.store.search(query);
    // Resume each matched session ONCE; index its blocks by id for full-body lookup.
    const bodies = new Map<string, Map<string, string>>(); // sessionId → (blockId → fullBody)
    for (const hit of hits) {
      if (bodies.has(hit.sessionId)) continue;
      const resumed = await entry.store.resume(hit.sessionId);
      const byId = new Map<string, string>();
      for (const block of resumed.blocks) byId.set(block.block.id, blockBody(block));
      bodies.set(hit.sessionId, byId);
    }
    const out: CrossProjectExcerpt[] = [];
    for (const hit of hits) {
      const fullBody = bodies.get(hit.sessionId)?.get(hit.blockId) ?? hit.snippet;
      const redacted = redactToExcerpt(fullBody, query);
      if (redacted.refused) continue; // AK-C1 — secret-carrying block never crosses
      out.push({
        projectPath: entry.path,
        projectName: entry.name,
        sessionId: hit.sessionId,
        blockId: hit.blockId,
        title: hit.title,
        snippet: redacted.snippet,
      });
    }
    return out;
  }
}
