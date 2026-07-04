/**
 * IDE self-telemetry (road-to-real-breadth P3): strictly opt-in, scrubbed,
 * local-only usage events. Distinct from {@link Telemetry} in agents.ts, which
 * is per-run token accounting — this is the IDE's own usage signal.
 *
 * Non-negotiable invariants (enforced by FileTelemetryStore + tests):
 *  - STRICT OPT-IN: disabled by default; `record` is a no-op until the user enables.
 *  - SCRUBBED: secret-bearing prop values are dropped; absolute home paths collapse to `~`.
 *  - NEVER FROM THE VAULT/CODE: the store holds no SecretStore and no source — it
 *    structurally cannot read a credential or a file body.
 *  - LOCAL-ONLY: events are appended to a local JSON file; no egress (a remote
 *    sink would go through the broker — a follow-on slice).
 */

/** One scrubbed IDE usage event. `seq` is monotonic (tamper-evident), not wall-clock. */
export interface TelemetryEvent {
  seq: number;
  kind: string;
  props: Record<string, string | number | boolean>;
}

export interface TelemetryProvider {
  /** Strict opt-in — false until the user turns it on. */
  isEnabled(): Promise<boolean>;
  /** Turn the local telemetry log on/off (persisted). */
  setEnabled(on: boolean): Promise<void>;
  /** Append a scrubbed event. No-op when disabled; secret-bearing values are dropped. */
  record(kind: string, props?: Record<string, string | number | boolean>): Promise<void>;
  /** The recorded events (local-only snapshot). */
  list(): Promise<TelemetryEvent[]>;
}
