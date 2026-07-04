/**
 * Sentry untrusted-text sanitizer — GATE G-SENTRY-SANITIZE
 * (road-to-sentry-observability P0).
 *
 * Issue titles, culprits, stacktraces, breadcrumbs and tags are **untrusted
 * external content**: an attacker who can produce a Sentry event controls these
 * strings. Before any of them is rendered (workspace tables, issue detail,
 * signal rail, `title` attributes) it passes through here.
 *
 * Guarantees: plain text only (HTML tags removed), no executable URI scheme
 * (`javascript:` / `vbscript:` / `data:`) — even with zero-width characters
 * interleaved to smuggle one — no control characters, length capped. React
 * escapes text nodes already; this is defense in depth for the non-JSX paths
 * (attributes, the shared signal rail) and against layout-breaking overlong
 * input. Pure + deterministic — no `Date`/`Math.random`.
 */

/** Default truncation budget for single-line fields (spec §0: 200 chars). */
export const SENTRY_TEXT_MAX = 200;

const TAG = /<[^>]*>/g;
// Residual angle brackets after tag removal (e.g. a lone `<`) — stripped so the
// output can never reopen a tag context.
const ANGLE = /[<>]/g;
// Zero-width / invisible / separator code points an attacker can interleave to
// smuggle a scheme past the scheme regex (e.g. zero-width space before the colon):
// zero-width space / (non-)joiner, LRM/RLM, word joiner, invisible operators, BOM.
const INVISIBLE = /[\u00AD\u200B-\u200F\u2060-\u2064\uFEFF]/g;
const DANGEROUS_SCHEME = /(?:javascript|vbscript|data)\s*:/gi;
// Control chars, excluding the whitespace the stacktrace variant keeps
// (\t = \x09, \n = \x0A, \r = \x0D). The single-line variant collapses those later.
// eslint-disable-next-line no-control-regex -- matching control chars is the point
const CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function coerce(input: unknown): string {
  const s = typeof input === "string" ? input : input == null ? "" : String(input);
  // NFKC folds compatibility forms (fullwidth, ligatures) to their canonical
  // equivalents so a scheme can't hide behind a compatibility glyph.
  return s.normalize("NFKC");
}

function clamp(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

/**
 * Sanitize a single-line untrusted field to safe plain text.
 * Strips HTML tags, invisible chars, executable URI schemes and control chars;
 * collapses whitespace to single spaces; truncates to `maxLen` with an ellipsis.
 */
export function sanitizeText(input: unknown, maxLen: number = SENTRY_TEXT_MAX): string {
  let s = coerce(input);
  s = s.replace(TAG, " ");
  s = s.replace(ANGLE, "");
  s = s.replace(INVISIBLE, "");
  s = s.replace(DANGEROUS_SCHEME, "");
  s = s.replace(CONTROL, "");
  s = s.replace(/\s+/g, " ").trim();
  return clamp(s, maxLen);
}

/** Issue / breadcrumb title. */
export const sanitizeIssueTitle = (v: unknown): string => sanitizeText(v);

/** Issue culprit (file/function locator). */
export const sanitizeCulprit = (v: unknown): string => sanitizeText(v);

/** Short tag / project / env / status / metric token — tighter cap. */
export const sanitizeTag = (v: unknown): string => sanitizeText(v, 64);

/**
 * Sanitize a multi-line stacktrace: each line is tag/scheme/control-stripped and
 * length-capped, the number of lines is capped, but newlines between lines are
 * preserved so the trace stays readable.
 */
export function sanitizeStacktrace(
  input: unknown,
  opts: { maxLines?: number; maxLineLen?: number } = {},
): string {
  const maxLines = opts.maxLines ?? 200;
  const maxLineLen = opts.maxLineLen ?? SENTRY_TEXT_MAX;
  const raw = coerce(input);
  const lines = raw.split(/\r?\n/).slice(0, maxLines);
  const cleaned = lines.map((line) => {
    const s = line
      .replace(TAG, " ")
      .replace(ANGLE, "")
      .replace(INVISIBLE, "")
      .replace(DANGEROUS_SCHEME, "")
      .replace(CONTROL, "");
    return clamp(s.replace(/[ \t]+/g, " ").trimEnd(), maxLineLen);
  });
  return cleaned.join("\n").trim();
}
