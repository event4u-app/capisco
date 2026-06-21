/**
 * Handoff summary builder (Phase 0 → Phase 1, token-economy).
 *
 * Turns a stored/resumed session's ordered transcript into a compact, COMPRESSED
 * carry-over summary — the seed text a fresh session starts with so it is NOT a
 * blank restart (better than Claude Code's empty new chat). The protected-token
 * byte-preservation of {@link compressMemory} keeps any code / paths / URLs in the
 * transcript verbatim, so the new session inherits exact references.
 *
 * PURE + DETERMINISTIC, browser-safe: the UI builds the summary from the resumed
 * blocks it already reads; no I/O, no Date.now/Math.random.
 */

import type { ResumedSession, TranscriptBlock } from "@/contracts";
import { compressMemory, type CompressionResult } from "./memory-compress.ts";

/** Render one transcript block to a single human-readable summary line. */
function blockToLine(block: TranscriptBlock): string | null {
  switch (block.type) {
    case "message": {
      const m = block.block;
      const who = m.who ?? (m.role === "user" ? "You" : "Agent");
      const body = m.body.trim();
      if (!body) return null;
      return `${who}: ${body}`;
    }
    case "tool": {
      const t = block.block;
      return `Tool: ${t.kind}${t.target ? ` → ${t.target}` : ""}`;
    }
    case "permission": {
      const p = block.block;
      return `Permission: ${p.command || p.label}`;
    }
  }
}

/** The built handoff: header + compressed body + the savings on the body. */
export interface HandoffSummary {
  /** The full seed text for the new session (header + compressed transcript). */
  text: string;
  /** Compression result on the transcript body (savings telemetry). */
  compression: CompressionResult;
  /** Number of transcript lines folded into the summary. */
  lineCount: number;
  /** The source session id this summary was carried from. */
  fromSessionId: string;
}

/**
 * Build a compressed handoff summary from a resumed session. The header names
 * the provenance (so the agent knows it is resuming, not starting fresh); the
 * body is the compressed transcript with all protected tokens preserved.
 */
export function buildHandoffSummary(resumed: ResumedSession): HandoffSummary {
  const lines: string[] = [];
  for (const block of resumed.blocks) {
    const line = blockToLine(block);
    if (line) lines.push(line);
  }
  const rawBody = lines.join("\n");
  const compression = compressMemory(rawBody);
  const header = `[Carried over from "${resumed.session.title}" — compressed context, not a fresh start]`;
  const text = compression.text ? `${header}\n\n${compression.text}` : header;
  return {
    text,
    compression,
    lineCount: lines.length,
    fromSessionId: resumed.session.id,
  };
}
