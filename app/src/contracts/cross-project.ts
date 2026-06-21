/**
 * Cross-Project Session-Bridge contracts (road-to-cross-project-knowledge P2,
 * concept §3.2 / feature-ide-linking.txt round 4).
 *
 * "Wie Claude-Sessions voneinander wissen": knowledge from an agent session in
 * project A used in the context of project B — e.g. frontend knowledge from A
 * for backend work in B. This is **retrieval on request from a shared store**,
 * not a live wire between running agents — the same motion as Claude's
 * conversation lookup, the filter being "other project" instead of "earlier
 * time".
 *
 * This is the SINGLE full lethal-trifecta surface of the whole bundle:
 * private-data (A's context) × untrusted (A's agent output) × cloud-egress
 * (B's prompt may reach a cloud model). TWO legs break, deliberately redundant:
 *
 *  - **EGRESS HUMAN-GATE (AK-C3)** — A-context → B's (cloud) prompt is a
 *    `network` egress derived `fromUntrusted` → a HARD `ask`, never auto-fired,
 *    never pre-clearable by a `session`/`scoped` grant (broker §3 MUST-NOT 4 /
 *    lethal trifecta).
 *  - **QUARANTINE (AK-C1 + AK-C2)** — the A→B extraction passes a redaction /
 *    inject stage that REFUSES value-shaped secrets (`:`/`=`/`password`/`token`
 *    form — the same vault discipline as audit/datasource `credentialRef`), and
 *    B receives only curated {@link CrossProjectExcerpt}s / summaries, NEVER a
 *    full-text getter across the project boundary (a 40-message transcript would
 *    both pollute B's context AND is the leak vector). Untrusted full text never
 *    reaches the egress.
 *
 * Hard invariants encoded in the shapes (verified by tests):
 *  - **AK-C4** — `cross-project-read` is a new broker scope axis, fail-closed,
 *    not in the default allowlist.
 *  - **AK-C5** — human-driven relevance: the caller names the source session /
 *    project explicitly. No auto-relevance, no automatic cross-project fan-out.
 *  - **AK-C6** — knowledge ≠ access: the bridge carries conversation/knowledge
 *    context ONLY. No code path lets B's agent trigger an operation on A's
 *    files/containers from an excerpt.
 */

import type { SessionStore } from "./session-store.ts";

/**
 * A curated, redacted excerpt of ONE matching block from a foreign project's
 * session — never the full transcript (AK-C2). The snippet has passed the
 * redaction stage (AK-C1): a value-shaped secret would have caused a refusal
 * upstream, so a constructed excerpt is provably secret-free across the
 * boundary. Carries provenance (which project / session / block) so the human
 * curating relevance (AK-C5) can audit where each line came from.
 */
export interface CrossProjectExcerpt {
  /** The source project's absolute root path (from the recent-projects registry). */
  projectPath: string;
  /** The source project's display name. */
  projectName: string;
  /** The source session id within that project's store. */
  sessionId: string;
  /** The matching block's id (provenance — never a full-text handle). */
  blockId: string;
  /** The session title (result-row context). */
  title: string;
  /**
   * The CURATED, redacted snippet — a short window around the match, never the
   * raw block body in full. Provably secret-free (the redaction stage refuses a
   * value-shaped secret rather than emitting it).
   */
  snippet: string;
}

/**
 * One project's store registered with the federation (the persistent,
 * cross-project-readable store prerequisite). `path` is the registry key (the
 * recent-projects absolute path); `name` is the display name; `store` is that
 * project's persistent session store. The shipped federation holds in-memory
 * fakes per project — the real swap is a disk-backed store per project root
 * behind the same {@link SessionStore} contract.
 */
export interface ProjectStoreEntry {
  path: string;
  name: string;
  store: SessionStore;
}

/**
 * The outcome of a cross-project egress attempt — A-context → B's (cloud)
 * prompt. The shape encodes the hard egress gate (AK-C3) into the type, exactly
 * like {@link import("./lifecycle.ts").StatusWriteOutcome}: an egress is only
 * `sent` when a human cleared the broker `ask`; otherwise it is `gated` (never
 * silently dropped, never auto-fired).
 */
export type CrossProjectEgressOutcome =
  | { status: "sent"; excerpts: CrossProjectExcerpt[] }
  | { status: "gated"; reason: string };

/**
 * The cross-project session bridge. Composes the per-project store federation,
 * the redaction stage, and the broker. Every method is human-driven (AK-C5):
 * the caller names the source project + session explicitly — there is no
 * "search every project automatically" method.
 */
export interface CrossProjectBridge {
  /**
   * Search a NAMED source project's session store for `query` and return CURATED
   * excerpts (AK-C2 — never full text). The read is a `cross-project-read`
   * broker capability (AK-C4, fail-closed): a project whose read is not
   * authorized resolves to an empty result with a gated reason, NEVER the
   * excerpts. Each returned excerpt has passed redaction (AK-C1).
   */
  searchProject(
    sourceProjectPath: string,
    query: string,
  ): Promise<{ authorized: boolean; excerpts: CrossProjectExcerpt[]; reason: string }>;
  /**
   * Curate excerpts from ONE explicitly-named A-session (AK-C5 — "pull from
   * THIS session"). Redacted (AK-C1), excerpts only (AK-C2). The full transcript
   * never crosses the boundary.
   */
  curateFromSession(
    sourceProjectPath: string,
    sessionId: string,
    query: string,
  ): Promise<CrossProjectExcerpt[]>;
  /**
   * Attempt to inject curated A-excerpts into B's (cloud) prompt. This is the
   * HARD egress gate (AK-C3): the egress is `network` + `fromUntrusted` → the
   * broker forces `ask`; a `session`/`scoped` grant can NOT pre-clear it. Only an
   * explicit per-call human decision (supplied by `humanClears`) sends it; a
   * gated/denied egress resolves `{ status: "gated" }` and NOTHING leaves the
   * machine. Two legs: the excerpts are already redacted+curated (quarantine),
   * AND this gate stands in front of the cloud.
   */
  injectIntoPrompt(
    excerpts: CrossProjectExcerpt[],
    cloudTarget: string,
  ): Promise<CrossProjectEgressOutcome>;
}
