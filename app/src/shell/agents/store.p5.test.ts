/**
 * Agent-Cockpit P5-A — store slice tests.
 *
 * Covers the message-queue actions (enqueue / dequeue / remove / reorder / edit)
 * and the run-completion seam that keeps a Stop from draining the queue:
 *  - `completeRun` settles to "ready" AND bumps `runCompletions`.
 *  - `cancelRun` settles to "ready" WITHOUT bumping — the drain never fires on Stop.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useAgents } from "./store.ts";

beforeEach(() => {
  useAgents.setState({ messageQueues: {}, runCompletions: {}, runStates: {} });
});

describe("message queue actions", () => {
  it("enqueues in FIFO order and ignores blank text", () => {
    const s = useAgents.getState();
    s.enqueueMessage("s1", "first");
    s.enqueueMessage("s1", "   ");
    s.enqueueMessage("s1", "second");
    expect(useAgents.getState().messageQueues["s1"].map((m) => m.text)).toEqual([
      "first",
      "second",
    ]);
  });

  it("assigns stable unique ids and trims whitespace", () => {
    const s = useAgents.getState();
    s.enqueueMessage("s1", "  padded  ");
    const [item] = useAgents.getState().messageQueues["s1"];
    expect(item.text).toBe("padded");
    expect(item.id).toMatch(/^q\d+$/);
  });

  it("dequeue returns the head and removes it; empties the key when drained", () => {
    const s = useAgents.getState();
    s.enqueueMessage("s1", "a");
    s.enqueueMessage("s1", "b");
    expect(useAgents.getState().dequeueMessage("s1")?.text).toBe("a");
    expect(useAgents.getState().messageQueues["s1"].map((m) => m.text)).toEqual(["b"]);
    expect(useAgents.getState().dequeueMessage("s1")?.text).toBe("b");
    expect(useAgents.getState().messageQueues["s1"]).toBeUndefined();
    expect(useAgents.getState().dequeueMessage("s1")).toBeUndefined();
  });

  it("removeQueued drops one item by id and deletes the key when empty", () => {
    const s = useAgents.getState();
    s.enqueueMessage("s1", "a");
    s.enqueueMessage("s1", "b");
    const bId = useAgents.getState().messageQueues["s1"][1].id;
    s.removeQueued("s1", bId);
    expect(useAgents.getState().messageQueues["s1"].map((m) => m.text)).toEqual(["a"]);
    const aId = useAgents.getState().messageQueues["s1"][0].id;
    s.removeQueued("s1", aId);
    expect(useAgents.getState().messageQueues["s1"]).toBeUndefined();
  });

  it("reorderQueued moves an item; out-of-range is a no-op", () => {
    const s = useAgents.getState();
    ["a", "b", "c"].forEach((t) => s.enqueueMessage("s1", t));
    s.reorderQueued("s1", 2, 0);
    expect(useAgents.getState().messageQueues["s1"].map((m) => m.text)).toEqual([
      "c",
      "a",
      "b",
    ]);
    s.reorderQueued("s1", 0, 9); // out of range
    expect(useAgents.getState().messageQueues["s1"].map((m) => m.text)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("editQueued replaces text; blank text removes the item", () => {
    const s = useAgents.getState();
    s.enqueueMessage("s1", "a");
    s.enqueueMessage("s1", "b");
    const aId = useAgents.getState().messageQueues["s1"][0].id;
    s.editQueued("s1", aId, "A!");
    expect(useAgents.getState().messageQueues["s1"][0].text).toBe("A!");
    s.editQueued("s1", aId, "   ");
    expect(useAgents.getState().messageQueues["s1"].map((m) => m.text)).toEqual(["b"]);
  });

  it("queues are isolated per session", () => {
    const s = useAgents.getState();
    s.enqueueMessage("s1", "one");
    s.enqueueMessage("s2", "two");
    expect(useAgents.getState().messageQueues["s1"].map((m) => m.text)).toEqual(["one"]);
    expect(useAgents.getState().messageQueues["s2"].map((m) => m.text)).toEqual(["two"]);
  });
});

describe("run-completion seam (drain vs. Stop)", () => {
  it("completeRun settles to ready and bumps the completion counter", () => {
    const s = useAgents.getState();
    s.setRunState("s1", "loading");
    s.completeRun("s1");
    expect(useAgents.getState().runStates["s1"]).toBe("ready");
    expect(useAgents.getState().runCompletions["s1"]).toBe(1);
    useAgents.getState().completeRun("s1");
    expect(useAgents.getState().runCompletions["s1"]).toBe(2);
  });

  it("cancelRun settles to ready WITHOUT bumping the completion counter", () => {
    const s = useAgents.getState();
    s.setRunState("s1", "loading");
    s.cancelRun("s1");
    expect(useAgents.getState().runStates["s1"]).toBe("ready");
    expect(useAgents.getState().runCompletions["s1"] ?? 0).toBe(0);
  });
});
