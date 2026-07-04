/**
 * InMemoryAuditStore (B4 Phase 1) — the append-only audit log (§3.4 / §4
 * invariant). The broker records an entry BEFORE it executes a capability:
 * actor + capability + credentialRef (the reference NAME, never the value) +
 * outcome.
 *
 * Append-only is enforced structurally: the public surface has only `record`
 * (append) and `list` (read) — there is no update or delete method, and `list`
 * returns a frozen, defensively-copied snapshot so a caller cannot mutate the
 * backing array. `seq` is a monotonic ordinal (not wall-clock) so the log is
 * deterministic and tamper-evident: a gap or reorder is visible.
 *
 * DEFERRED swap: a durable append-only log (e.g. a hash-chained file) is a thin
 * swap behind this same contract.
 */

import type { AuditEntry, AuditStore, Unsubscribe } from "@/contracts";
import { isRtkFiltered } from "@/contracts";

export class InMemoryAuditStore implements AuditStore {
  readonly #entries: AuditEntry[] = [];
  readonly #observers = new Set<(entry: AuditEntry) => void>();
  #seq = 0;

  record(entry: Omit<AuditEntry, "seq">): AuditEntry {
    // Defensive: a credentialRef is a name; a value-shaped string here would be
    // a leak. We never store a `value` field — the type has none — but we also
    // refuse to record a credentialRef that looks like an injected secret value.
    if (entry.credentialRef && looksLikeSecretValue(entry.credentialRef)) {
      throw new Error(
        "audit credentialRef must be a reference name, never a secret value",
      );
    }
    // RTK TRUST BOUNDARY (Phase 3, AK-T1/T2): RTK-filtered text is LLM-facing
    // only; the audit log is an authoritative FACT surface. Refuse any field
    // carrying the RTK marker — RTK output can never become an audit record.
    if (
      isRtkFiltered(entry.target) ||
      isRtkFiltered(entry.capability) ||
      (entry.credentialRef !== undefined && isRtkFiltered(entry.credentialRef))
    ) {
      throw new Error(
        "audit refuses RTK-filtered (LLM-facing-only) input — RTK output is an " +
          "observation, never an authoritative audit fact (AK-T1/T2)",
      );
    }
    const recorded: AuditEntry = { ...entry, seq: ++this.#seq };
    // Freeze each entry so a holder of the return value cannot rewrite history.
    this.#entries.push(Object.freeze(recorded));
    // Notify live observers AFTER the append, with the frozen entry — the same
    // value `list` exposes (no new disclosure surface). A throwing observer is
    // isolated per-listener: `record` runs BEFORE the broker executes, so an
    // unhandled observer error must never break the append or the chokepoint.
    for (const observer of this.#observers) {
      try {
        observer(recorded);
      } catch {
        /* an observer's failure is its own; never corrupts the audit log */
      }
    }
    return recorded;
  }

  list(): readonly AuditEntry[] {
    // A frozen copy — the caller cannot append/splice the real log.
    return Object.freeze([...this.#entries]);
  }

  subscribe(listener: (entry: AuditEntry) => void): Unsubscribe {
    this.#observers.add(listener);
    return () => {
      this.#observers.delete(listener);
    };
  }
}

/**
 * Heuristic guard: a credential REFERENCE is a short name like `prod-readonly`
 * or `staging-admin`. A reference must not carry value-shaped markers (a `:`/
 * `=` assignment, `password`/`token`/`secret` payloads, or long opaque blobs).
 * Mirrors the R6 datasource-credential test in the UI track.
 */
export function looksLikeSecretValue(ref: string): boolean {
  if (/[:=]/.test(ref)) return true;
  if (/\b(password|passwd|secret|token|apikey|api_key|bearer)\b/i.test(ref)) {
    return true;
  }
  // A reference name is short; a 40+ char opaque blob is almost certainly a value.
  if (ref.length > 40 && /[^a-z0-9._-]/i.test(ref)) return true;
  return false;
}
