/**
 * Caveman terse mode (Phase 2, token-economy) — the vendored terse RULESET +
 * the system-context INJECTOR, shared by BOTH agent backends (the ACP stdio path
 * and the native stream-json path).
 *
 * ─── ATTRIBUTION ────────────────────────────────────────────────────────────
 * Adapted from the MIT-licensed "Caveman" terse-output ruleset idiom (a prompt
 * directive that asks the model to answer in a terse, telegraphic style to save
 * OUTPUT tokens). We vendor the BEHAVIOURAL SPEC as data and inject it natively
 * into the system context — Capisco owns the agent client, so this is an
 * injection, NOT an installed skill / JS installer.
 *
 *   SPDX-License-Identifier: MIT
 *   Vendored ruleset — see DECISIONS.md "Caveman-Form".
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   HARD INVARIANT (AK-T3, Caveman-Negativ-Assert): terse mode shapes ONLY the
 *   model's free-form EXPLANATION. It never touches FACTS or SAFETY surfaces —
 *   diagnostics, broker permission prompts, secret references, the audit log, and
 *   commit messages. Those surfaces flow through the broker / audit / quality
 *   paths and NEVER through this injector, so the bypass is STRUCTURAL: the
 *   injector is a pure function over the AGENT PROMPT STRING only. There is no
 *   code path by which a border surface reaches `injectTerseDirective`.
 *
 * The ruleset is NOT golden-tested as model OUTPUT (that is LLM behaviour, Class
 * C). What IS tested: that the directive marker lands in the sent system context
 * when terse is on, is absent when opted out, and that the border surfaces never
 * carry it.
 */

/** Terse verbosity level — selectable per session in the composer control bar. */
export type TerseLevel = "lite" | "full" | "ultra";

/** The default level when terse is on (full = the balanced reduction). */
export const DEFAULT_TERSE_LEVEL: TerseLevel = "full";

/** A stable marker the positive-assert greps for in the sent system context. */
export const TERSE_DIRECTIVE_MARKER = "<!-- capisco:caveman-terse -->";

/** The vendored per-level directive bodies (behavioural spec, not model output). */
const LEVEL_BODY: Record<TerseLevel, string> = {
  lite: [
    "Terse mode (lite): trim filler from prose explanations. Drop pleasantries,",
    "hedging, and restating the question. Keep full sentences where clarity needs them.",
  ].join(" "),
  full: [
    "Terse mode (full): answer in a terse, telegraphic style. Drop articles and",
    "linking verbs where unambiguous. No preamble, no summary, no flattery. Bullet",
    "lists over paragraphs. This shapes EXPLANATIONS ONLY — never abbreviate code,",
    "file paths, URLs, identifiers, numbers, error messages, or command lines.",
  ].join(" "),
  ultra: [
    "Terse mode (ultra): maximally compressed prose. Cave-speak grammar — primitive",
    "verbs, no articles, no pronouns where context is clear. One line per point.",
    "EXPLANATIONS ONLY — code, paths, URLs, identifiers, numbers, and command lines",
    "stay verbatim and complete.",
  ].join(" "),
};

/**
 * The terse configuration for a session: whether it is on (default ON, opt-out
 * per session) and at which level.
 */
export interface TerseConfig {
  /** Default true — terse is on unless the session opted out. */
  enabled: boolean;
  level: TerseLevel;
}

/** The default terse config: ON at `full` (the product decision — opt-out per session). */
export const DEFAULT_TERSE_CONFIG: TerseConfig = { enabled: true, level: DEFAULT_TERSE_LEVEL };

/**
 * Build the terse system directive for a config, or `undefined` when terse is
 * off (opt-out). The directive opens with {@link TERSE_DIRECTIVE_MARKER} so the
 * positive-assert can detect it in the sent system context without depending on
 * the (vendored, mutable) wording.
 */
export function terseDirective(config: TerseConfig = DEFAULT_TERSE_CONFIG): string | undefined {
  if (!config.enabled) return undefined;
  return `${TERSE_DIRECTIVE_MARKER}\n${LEVEL_BODY[config.level]}`;
}

/**
 * Inject the terse directive into an AGENT PROMPT (the only surface terse may
 * shape). Pure: returns a NEW string. When terse is off, returns the prompt
 * unchanged (no marker). This is the SINGLE chokepoint — border surfaces
 * (diagnostics / broker prompts / secrets / audit / commit messages) never call
 * it, so they structurally cannot carry the directive.
 */
export function injectTerseDirective(
  prompt: string,
  config: TerseConfig = DEFAULT_TERSE_CONFIG,
): string {
  const directive = terseDirective(config);
  if (!directive) return prompt;
  // The directive is system context PREPENDED to the user prompt; the prompt
  // itself is unchanged below the marker (still the untrusted user/ToDo text).
  return `${directive}\n\n${prompt}`;
}

/** True when a string carries the terse directive marker (assert helper). */
export function hasTerseDirective(text: string): boolean {
  return text.includes(TERSE_DIRECTIVE_MARKER);
}
