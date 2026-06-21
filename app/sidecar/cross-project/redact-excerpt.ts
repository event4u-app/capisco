/**
 * Cross-project redaction / inject stage (road-to-cross-project-knowledge P2,
 * AK-C1 + AK-C2) — the QUARANTINE leg of the lethal-trifecta defense.
 *
 * Knowledge from project A is curated into excerpts for project B. Two hard
 * rules, both enforced here so untrusted full text never reaches the egress:
 *
 *  - **AK-C1 — vault discipline on the bridge path.** A block whose text carries
 *    a value-shaped secret (`:`/`=` assignment, `password`/`token`/`secret`
 *    payload, a long opaque blob) is REFUSED — never passed through, never
 *    silently rewritten. Same discipline as audit / datasource `credentialRef`
 *    ({@link looksLikeSecretValue}), extended with inline `key=value` /
 *    `key: value` secret-assignment detection. A refusal is loud (the caller
 *    drops the block), not a soft scrub.
 *  - **AK-C2 — curated excerpts, never full text.** Even a clean block is
 *    reduced to a short snippet window around the match. There is no path that
 *    emits a full block body across the boundary.
 *
 * Pure + deterministic — no DOM, no I/O, no Date.now / Math.random.
 */

/** Max characters of a curated snippet (AK-C2 — never the full body). */
export const MAX_SNIPPET = 160;

/**
 * Value-shaped secret patterns a block body may carry. A session block is free
 * PROSE (unlike the short credential-reference guard `looksLikeSecretValue` in
 * the audit store, which also treats any long space-containing string as a
 * blob — wrong for prose). So we scan only for the discriminating shapes:
 *  - a credential KEYWORD immediately followed by an assignment (`password=…`,
 *    `token: …`, `AWS_SECRET=…`, `Authorization: Bearer …`),
 *  - a PEM private-key header,
 *  - a bare assignment whose value is a long opaque high-entropy token.
 *
 * Same `:`/`=`/`password`/`token` discipline as the datasource `credentialRef`
 * test (R6) + the audit-store refusal — extended for inline prose.
 */
const INLINE_SECRET = [
  /\b(password|passwd|secret|token|apikey|api[_-]?key|bearer|authorization|access[_-]?key|private[_-]?key)\b\s*[:=]/i,
  /\b(bearer)\s+[A-Za-z0-9+/_-]{16,}/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  // A bare assignment whose value looks high-entropy (>= 20 token chars, no spaces).
  /[:=]\s*["']?[A-Za-z0-9+/_-]{20,}={0,2}["']?/,
];

/** True when a block body carries a value-shaped secret and must be refused. */
export function carriesSecret(text: string): boolean {
  return INLINE_SECRET.some((re) => re.test(text));
}

/**
 * Redact + curate a block body into a cross-project snippet, or REFUSE it.
 *
 * Returns `{ refused: true }` when the body carries a value-shaped secret
 * (AK-C1) — the caller drops the block, it never crosses the boundary. Returns
 * a short curated snippet otherwise (AK-C2), centered on `query` when present.
 */
export function redactToExcerpt(
  text: string,
  query: string,
): { refused: true } | { refused: false; snippet: string } {
  if (carriesSecret(text)) return { refused: true };
  return { refused: false, snippet: curate(text, query) };
}

/** A short, deterministic snippet window around the match (no full body). */
function curate(text: string, query: string): string {
  const needle = query.trim().toLowerCase();
  const i = needle ? text.toLowerCase().indexOf(needle) : 0;
  const center = i === -1 ? 0 : i;
  const start = Math.max(0, center - 24);
  const end = Math.min(text.length, start + MAX_SNIPPET);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}
