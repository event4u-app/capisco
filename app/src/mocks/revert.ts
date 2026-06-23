import type { RevertOutcome, RevertProvider } from "@/contracts";

/**
 * Browser / test revert fallback (B0). The deterministic mock backend reports a
 * successful revert for any path — the real broker-gated, git-authoritative
 * {@link BrokerReverter} (with the honest no-worktree `skipped` path and the
 * argv-isolation guarantee) is swapped in over the dev bridge. The UI gates the
 * affordance on the session having a worktree, not on this provider.
 */
export const mockRevertProvider: RevertProvider = {
  revertPath(_cwd: string, path: string): Promise<RevertOutcome> {
    return Promise.resolve({ status: "reverted", path });
  },
};
