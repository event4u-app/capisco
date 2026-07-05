import type { AuditEntry, AuditStore, Unsubscribe } from "@/contracts";

/**
 * Deterministic broker-audit mock (agent-matrix P0 · broker-ticker). Mirrors the
 * sidecar `InMemoryAuditStore` shape (append-only: `record`/`list`/`subscribe`,
 * no mutation) so the Matrix broker-ticker + audit-viewer consume the real
 * contract in the browser/test path. No `Date.now`/random — `seq` is the
 * monotonic order.
 *
 * SECRET INVARIANT (Konzept §3.2): a capability references a secret ONLY via
 * `credentialRef` (the NAME), and `AuditEntry` has no value field at all — so a
 * secret value is structurally impossible to record or render here.
 */
const SCRIPTED: Omit<AuditEntry, "seq">[] = [
  {
    principalId: "you",
    principalKind: "human",
    capability: "shell",
    target: "git status",
    outcome: "allow",
    fromUntrusted: false,
    reason: "allowlist: git status*",
  },
  {
    principalId: "agent-s1",
    principalKind: "agent",
    capability: "file-write",
    target: "src/core/worktree.ts",
    outcome: "ask",
    fromUntrusted: false,
    reason: "file-write requires a human gate",
  },
  {
    principalId: "agent-s1",
    principalKind: "agent",
    capability: "file-write",
    target: "src/core/worktree.ts",
    outcome: "executed",
    fromUntrusted: false,
    reason: "human granted (once)",
  },
  {
    principalId: "agent-s3",
    principalKind: "agent",
    capability: "secret-read",
    // Reference name only — never a value.
    target: "staging-admin",
    credentialRef: "staging-admin",
    outcome: "ask",
    fromUntrusted: false,
    reason: "secret-read requires a human gate",
  },
  {
    principalId: "agent-s1",
    principalKind: "agent",
    capability: "external-write",
    target: "https://api.example.com/webhook",
    outcome: "deny",
    fromUntrusted: true,
    reason: "untrusted-egress hard gate (lethal trifecta)",
  },
];

class InMemoryMockAuditStore implements AuditStore {
  #entries: AuditEntry[];
  readonly #listeners = new Set<(e: AuditEntry) => void>();

  constructor(seed: Omit<AuditEntry, "seq">[]) {
    this.#entries = seed.map((e, i) => Object.freeze({ ...e, seq: i + 1 }) as AuditEntry);
  }

  record(entry: Omit<AuditEntry, "seq">): AuditEntry {
    const e = Object.freeze({ ...entry, seq: this.#entries.length + 1 }) as AuditEntry;
    this.#entries = [...this.#entries, e];
    for (const l of this.#listeners) {
      try {
        l(e);
      } catch {
        // A throwing observer is isolated — it never breaks the append.
      }
    }
    return e;
  }

  list(): readonly AuditEntry[] {
    return this.#entries;
  }

  subscribe(listener: (entry: AuditEntry) => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}

/** Deterministic broker-audit store for the browser/mock path. */
export const mockAuditStore: AuditStore = new InMemoryMockAuditStore(SCRIPTED);

/** Factory for tests that need an isolated, empty store. */
export function createMockAuditStore(seed: Omit<AuditEntry, "seq">[] = []): AuditStore {
  return new InMemoryMockAuditStore(seed);
}
