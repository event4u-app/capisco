import type { ShadowStore, Snapshot, SnapshotReason } from "@/contracts";

/**
 * Deterministic in-memory History-2 shadow store (§5.1). Append-only: `record`
 * adds a snapshot, prior snapshots are never mutated or dropped. Separate from
 * git — captures uncommitted intermediate states so a destructive agent edit is
 * always recoverable. The real store is content-addressed on disk; this fake
 * uses a monotonic `seq` (no wall-clock) so tests are deterministic.
 */
export function createInMemoryShadowStore(seed: Snapshot[] = []): ShadowStore {
  const snapshots: Snapshot[] = [...seed];
  let seq = seed.reduce((m, s) => Math.max(m, s.seq), 0);

  const label = (reason: SnapshotReason): string =>
    reason === "save" ? "Save" : "External change";

  return {
    record(file, content, reason) {
      const snap: Snapshot = {
        id: `snap-${++seq}`,
        file,
        content,
        reason,
        seq,
        label: label(reason),
      };
      snapshots.push(snap);
      return Promise.resolve(snap);
    },
    list(file) {
      return Promise.resolve(snapshots.filter((s) => s.file === file).sort((a, b) => a.seq - b.seq));
    },
    get(id) {
      return Promise.resolve(snapshots.find((s) => s.id === id) ?? null);
    },
    restore(id) {
      return Promise.resolve(snapshots.find((s) => s.id === id)?.content ?? null);
    },
  };
}

/**
 * A pre-seeded shadow store mirroring the "agent shredded broker.ts" rescue
 * story: an original Save, then an external change, then the agent's
 * destructive edit — so the timeline can offer a restore to any prior state.
 */
export const mockShadowStore: ShadowStore = createInMemoryShadowStore([
  {
    id: "snap-1",
    file: "broker.ts",
    content: "// original — checkCapability returns a boolean\n",
    reason: "save",
    seq: 1,
    label: "Save",
  },
  {
    id: "snap-2",
    file: "broker.ts",
    content: "// external change — mara added a scope cache\n",
    reason: "external",
    seq: 2,
    label: "External change",
  },
  {
    id: "snap-3",
    file: "broker.ts",
    content: "// agent edit — refactored grants into a frozen record\n",
    reason: "save",
    seq: 3,
    label: "Save",
  },
]);
