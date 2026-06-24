/**
 * Broker-gated context-ingestion chokepoint (road-to-composer-context-runtime
 * P2, threat-pass `agents/contexts/file-ingestion-contract.md`).
 *
 * The SINGLE path both `+`-Add and Drag&Drop funnel through. Mirrors the
 * {@link BrokerFsWriter} write seam, for READ/ingestion:
 *
 *   secret-form scan  →  source-tag  →  authorize(file-read)  →  [ask→resolve]
 *     →  REFERENCE { path, displayName, sourceTag }   (never the bytes)
 *
 * Invariants (the mandatory tests pin them):
 *  - A secret-shaped path is REFUSED here, at the boundary — never ingested.
 *  - A prod-datasource-origin path carries its `prod:*` tag INTO the read-only
 *    reference, set at ingestion (not deferred to read).
 *  - Ingestion NEVER returns content — only a reference or a refusal. The bytes
 *    are read on-demand later, through the same broker-gated read path.
 *
 * SECURITY: this runs in-process at the execution layer (like the broker's
 * `execute`), never RPC-fired. The path crosses the wire (it is the file the
 * human attached, not a secret); the secret/prod DECISION is made here.
 */

import type {
  CapabilityBroker,
  CapabilityRequest,
  IngestOutcome,
  IngestProvider,
  PermissionDecision,
  Principal,
} from "@/contracts";
import {
  type DatasourceRoot,
  ingestDisplayName,
  looksLikeSecretPath,
  tagForPath,
} from "@/lib/sidecar/ingest-core.ts";

export { looksLikeSecretPath, type DatasourceRoot };

/** Context attach is HUMAN-initiated (the user picked/dropped the file). */
const HUMAN: Principal = { id: "human", kind: "human", label: "You" };

/**
 * Human-in-the-loop gate for a context-read. Defaults to deny-all (fail
 * closed); a real registration passes a resolver that clears the `ask` for a
 * human-initiated attach (mirrors the editor-save resolver).
 */
export type IngestResolver = (
  request: CapabilityRequest,
) => Promise<PermissionDecision> | PermissionDecision;

const DENY_ALL: IngestResolver = () => ({ axis: "deny" });

export interface BrokerIngestorOptions {
  broker: CapabilityBroker;
  /** Datasource roots used to tag a path's origin at ingestion. */
  datasources?: readonly DatasourceRoot[];
  /** Human-gate resolver (defaults to deny-all). A real attach clears it. */
  resolvePermission?: IngestResolver;
}

export class BrokerIngestor implements IngestProvider {
  readonly #broker: CapabilityBroker;
  readonly #datasources: readonly DatasourceRoot[];
  readonly #resolve: IngestResolver;

  constructor(opts: BrokerIngestorOptions) {
    this.#broker = opts.broker;
    this.#datasources = opts.datasources ?? [];
    this.#resolve = opts.resolvePermission ?? DENY_ALL;
  }

  async ingestFile(path: string): Promise<IngestOutcome> {
    const displayName = ingestDisplayName(path);

    // 1. Secret-form scan AT the boundary — never ingested, audited as a deny.
    if (looksLikeSecretPath(path)) {
      this.#broker.audit.record({
        principalId: HUMAN.id,
        principalKind: HUMAN.kind,
        capability: "file-read",
        target: path,
        outcome: "deny",
        fromUntrusted: false,
        reason: "ingestion refused: secret-form path",
      });
      return {
        status: "refused",
        reason: "secret-form file — never ingested as context",
        displayName,
      };
    }

    // 2. Origin tag at ingestion (prod rides into the read-only reference).
    const sourceTag = tagForPath(path, this.#datasources);

    // 3. Broker file-read authorize (fails closed → ask; human attach clears).
    const request: CapabilityRequest = { kind: "file-read", target: path };
    const decision = this.#broker.authorize(HUMAN, request);
    let allowed = decision.outcome === "allow";
    if (decision.outcome === "ask") {
      const resolved = await this.#resolve(request);
      this.#broker.resolve(HUMAN, request, resolved);
      allowed = resolved.axis !== "deny";
    }
    if (!allowed) {
      return {
        status: "refused",
        reason: "file-read denied by broker policy",
        displayName,
      };
    }

    // 4. Reference only — NEVER the bytes. prod tag already attached.
    return { status: "reference", entry: { path, displayName, sourceTag } };
  }
}
