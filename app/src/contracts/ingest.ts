/**
 * Context-ingestion contract (road-to-composer-context-runtime P2, threat-pass
 * `agents/contexts/file-ingestion-contract.md`).
 *
 * A file attached to the composer (`+`-Add OR Drag&Drop) is a CONTEXT
 * REFERENCE, never an eager content snapshot: the entry carries `{ path,
 * displayName, sourceTag }` and the backend reads the bytes on-demand at
 * send-time through the SAME broker-gated read path. Both attach affordances
 * funnel through the single `ingestFile` chokepoint — there is no second
 * ingestion path (the core attack-surface; see mandatory test 4).
 *
 * Secret-form and production-datasource origin are scanned HERE, at the
 * ingestion boundary (not first at read): a secret-shaped path is refused, a
 * prod-origin path carries its `prod:*` tag into the read-only reference. The
 * raw value is NEVER returned by ingestion — only a reference or a refusal.
 */

/**
 * Where an ingested file came from. `local` = an ordinary workspace file;
 * `prod:<name>` = derived from a production datasource (structurally
 * read-only); `datasource:<name>` = a non-prod datasource export. The tag is
 * set at the ingestion boundary and re-checked at read.
 */
export type ContextSourceTag = "local" | `prod:${string}` | `datasource:${string}`;

/** A context entry — a path REFERENCE, never a content snapshot. */
export interface ContextEntry {
  /** Absolute path the backend reads on-demand at send-time (broker-gated). */
  path: string;
  /** Short label for the chip (basename). Never a secret value. */
  displayName: string;
  /** Origin tag, set at ingestion, re-checked at read. */
  sourceTag: ContextSourceTag;
}

/**
 * The result of ingesting one path. Either a read-only reference (the value is
 * NOT included — it is read on-demand later through the broker) or a refusal
 * carrying a human-readable reason. There is deliberately no `content`/`value`
 * field on either arm — ingestion never returns bytes.
 */
export type IngestOutcome =
  | { status: "reference"; entry: ContextEntry }
  | { status: "refused"; reason: string; displayName: string };

/**
 * The single ingestion chokepoint. `+`-Add and Drag&Drop both call
 * `ingestFile`; it runs the broker `file-read` authorize plus the secret-form /
 * prod-origin scan, and returns a reference or a refusal — never the file's
 * bytes.
 */
export interface IngestProvider {
  ingestFile(path: string): Promise<IngestOutcome>;
}
