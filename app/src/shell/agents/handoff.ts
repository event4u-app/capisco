/**
 * Red→new-session handoff (Phase 1, token-economy). The MECHANIC behind the
 * Design-Sync P4 Rot-banner (which shipped its `[New session]` / `[Keep going]`
 * buttons as No-op stubs). At red (`crit` budget tone) the human MAY start a
 * fresh session — and unlike Claude Code's empty restart, the fresh session is
 * seeded with a COMPRESSED summary of the old one (token-economy P0). No
 * auto-switch: the human always clicks the button; nothing here fires on its own.
 *
 * This module is the pure, deterministic core (browser-safe): given the active
 * session and its transcript blocks, it builds the seed and the new session
 * record. The store action + the banner wire it; the test asserts the handoff
 * shape (seed carries the old context, provenance is recorded, the parent is
 * never mutated — B3 tamper discipline).
 */

import type { Session, TranscriptBlock, ResumedSession, SessionTree } from "@/contracts";
import { buildHandoffSummary, type HandoffSummary } from "@/lib/compress/handoff-summary.ts";

/** A handoff: the seeded new session + the compressed summary it carries. */
export interface SessionHandoff {
  /** The new (fresh) session, seeded for the human to continue in. */
  session: Session;
  /** The compressed carry-over summary (seed text + savings telemetry). */
  summary: HandoffSummary;
}

/** An empty tree placeholder for the resumed-session view we synthesise. */
const EMPTY_TREE: SessionTree = { nodes: {}, roots: [], activeLeaf: "" };

/**
 * Build a Red→new-session handoff from the active session and its blocks. The
 * new session:
 *  - gets a fresh id (caller supplies the index-derived id),
 *  - inherits the old model,
 *  - records provenance via `title` (and the summary's `fromSessionId`),
 *  - starts with ZERO telemetry (a genuinely fresh, lean context — that is the
 *    whole point of the handoff: drop the bloat, keep the meaning),
 *  - carries the compressed summary as its seed text.
 *
 * The PARENT session is NEVER mutated — this returns a NEW record only (B3
 * retry/copy tamper discipline: a handoff branches forward, it never overwrites
 * the origin).
 */
export function buildSessionHandoff(
  parent: Session,
  blocks: TranscriptBlock[],
  newId: string,
  newTitle: string,
): SessionHandoff {
  // Synthesise the resumed-session view the summary builder consumes from what
  // the UI already holds (the active session + its transcript blocks).
  const resumed: ResumedSession = {
    session: {
      id: parent.id,
      model: parent.model,
      status: parent.status,
      title: parent.title,
      telemetry: parent.telemetry,
      seq: 0,
    },
    blocks,
    tree: EMPTY_TREE,
  };
  const summary = buildHandoffSummary(resumed);
  const session: Session = {
    id: newId,
    model: parent.model,
    status: "idle",
    title: newTitle,
    // Fresh, lean context — the handoff's reason for existing.
    telemetry: { tokensIn: 0, tokensOut: 0, runtimeMs: 0 },
  };
  return { session, summary };
}
