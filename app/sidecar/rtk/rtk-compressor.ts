/**
 * RTK observation-compressor (Phase 3, token-economy). Decides WHEN to run the
 * external `rtk` binary, and brands its output LLM-facing-ONLY so the type system
 * keeps it off every authoritative path.
 *
 * SCOPE (AK-T1/T2 trust boundary — the hard part):
 *  - ONLY the unstructured LONG-TAIL: `ls` / `find` / `docker ps` / any CLI
 *    WITHOUT a native parser. These have no typed shape — RTK's domain.
 *  - NEVER an authoritative source: git (B1) and quality (B5) parse their output
 *    into typed shapes the UI / broker rely on; the audit log, diagnostics,
 *    broker permission prompts, and secret references are FACTS/SAFETY. None of
 *    these pass through here. `compressObservation` refuses an `Authoritative`
 *    source outright (throws) — so a border surface cannot be routed through RTK
 *    even by mistake.
 *
 * CLEAN DEGRADE: `rtk` missing / failing → the raw text is passed through
 * unchanged (still branded LLM-facing-only for the model), `compressed:false`,
 * NO hard-fail. The degrade path runs NO substitute logic over a border surface
 * (it only ever sees a long-tail observation in the first place).
 */

import {
  brandLlmFacing,
  type RtkObservation,
  type ObservationTag,
} from "@/contracts";
import { rtkCompress, type RtkExecOptions } from "./rtk-exec.ts";

/**
 * Observation sources Capisco produces. The `*-longtail` sources are RTK's
 * domain (no native parser). The `authoritative` source marks anything the
 * broker / UI rely on as fact (git, quality, audit, diagnostics) — RTK refuses
 * it. The set is the structural gate: a caller names its source, and the
 * compressor refuses the authoritative one.
 */
export type ObservationSource =
  | "shell-longtail"
  | "ls-longtail"
  | "find-longtail"
  | "docker-ps-longtail"
  | "authoritative";

/** Sources RTK is allowed to compress (the unstructured long-tail only). */
const LONGTAIL_SOURCES: ReadonlySet<ObservationSource> = new Set([
  "shell-longtail",
  "ls-longtail",
  "find-longtail",
  "docker-ps-longtail",
]);

/** True when a source is RTK-eligible (unstructured long-tail). */
export function isLongTailSource(source: ObservationSource): boolean {
  return LONGTAIL_SOURCES.has(source);
}

export interface CompressObservationOptions extends RtkExecOptions {
  /** Where the raw text came from. An `authoritative` source is REFUSED. */
  source: ObservationSource;
}

/**
 * Compress one long-tail observation through RTK, branding the result
 * LLM-facing-only. Refuses an authoritative source (throws — a border surface
 * must never reach RTK). Degrades cleanly when `rtk` is unavailable: raw text
 * passed through, branded, `compressed:false`.
 */
export async function compressObservation(
  raw: string,
  opts: CompressObservationOptions,
): Promise<RtkObservation> {
  // STRUCTURAL GATE: an authoritative source can never be routed through RTK.
  if (!isLongTailSource(opts.source)) {
    throw new Error(
      `RTK refuses an authoritative source ("${opts.source}") — git/quality/audit/diagnostics ` +
        "stay authoritative; RTK is the LLM-facing long-tail compressor only (AK-T1/T2)",
    );
  }

  const rawBytes = Buffer.byteLength(raw, "utf8");
  const filtered = await rtkCompress(raw, opts);

  if (filtered === undefined) {
    // CLEAN DEGRADE: rtk missing / failed → pass the raw text through, branded.
    const text = brandLlmFacing(raw);
    return {
      text,
      tag: "LlmFacingOnly",
      rawBytes,
      compressedBytes: rawBytes,
      compressed: false,
    };
  }

  const text = brandLlmFacing(filtered);
  return {
    text,
    tag: "RtkFiltered",
    rawBytes,
    compressedBytes: Buffer.byteLength(filtered, "utf8"),
    compressed: true,
  };
}

/** The tag the broker / audit refuse to accept (LLM-facing surfaces only). */
export const LLM_FACING_TAGS: ReadonlyArray<ObservationTag> = ["RtkFiltered", "LlmFacingOnly"];
