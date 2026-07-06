/**
 * Deterministic mock of the agent's pending `file-write` look-ahead (item 229).
 * Feeds the scoped-grant pattern-coverage preview until the real run-loop supplies
 * a live feed. Fixed data → the preview + any golden are stable.
 */

import type { PendingWriteIntent } from "@/contracts";

const ROOT = "/repo";

/** A representative batch: several writes under `src/`, one outside (`config/`). */
export const mockPendingWrites: PendingWriteIntent[] = [
  { taskId: "task-1", relTarget: "src/app.ts", canonicalTarget: `${ROOT}/src/app.ts` },
  {
    taskId: "task-1",
    relTarget: "src/lib/util.ts",
    canonicalTarget: `${ROOT}/src/lib/util.ts`,
  },
  {
    taskId: "task-1",
    relTarget: "src/ui/panel.tsx",
    canonicalTarget: `${ROOT}/src/ui/panel.tsx`,
  },
  {
    taskId: "task-1",
    relTarget: "config/app.json",
    canonicalTarget: `${ROOT}/config/app.json`,
  },
];
