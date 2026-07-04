/**
 * Unit tests for `useHistoryRecall` (input reliability P4).
 *
 * The hook is purely imperative (no React state). All tests drive `onKeyDown`
 * directly with a real HTMLTextAreaElement so we verify the concrete DOM
 * mutations the hook makes.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHistoryRecall } from "./use-history-recall.ts";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Create a fake KeyboardEvent-like object sufficient for the hook. */
function key(k: string): KeyboardEvent & { defaultPrevented: boolean } {
  let prevented = false;
  return {
    key: k,
    preventDefault() {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    },
  } as unknown as KeyboardEvent & { defaultPrevented: boolean };
}

/** Make a real textarea (jsdom) so setSelectionRange works. */
function makeEl(value = ""): HTMLTextAreaElement {
  const el = document.createElement("textarea");
  el.value = value;
  return el;
}

const LOG = ["first", "second", "third"]; // most-recent-last

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("useHistoryRecall — ArrowUp enters recall", () => {
  it("loads the most-recent entry on first ↑ from empty field", () => {
    const { result } = renderHook(() => useHistoryRecall(LOG));
    const el = makeEl("");
    const e = key("ArrowUp");

    const consumed = result.current.onKeyDown(e, el, "");
    expect(consumed).toBe(true);
    expect(e.defaultPrevented).toBe(true);
    expect(el.value).toBe("third"); // last entry = most-recent
  });

  it("does NOT consume ArrowUp when the field is non-empty", () => {
    const { result } = renderHook(() => useHistoryRecall(LOG));
    const el = makeEl("some text");
    const e = key("ArrowUp");

    const consumed = result.current.onKeyDown(e, el, "some text");
    expect(consumed).toBe(false);
    expect(e.defaultPrevented).toBe(false);
    expect(el.value).toBe("some text"); // unchanged
  });

  it("does nothing when log is empty", () => {
    const { result } = renderHook(() => useHistoryRecall([]));
    const el = makeEl("");
    const e = key("ArrowUp");

    const consumed = result.current.onKeyDown(e, el, "");
    expect(consumed).toBe(false);
  });
});

describe("useHistoryRecall — walking backward through the log", () => {
  it("steps from newest to oldest with repeated ↑", () => {
    const { result } = renderHook(() => useHistoryRecall(LOG));
    const el = makeEl("");

    result.current.onKeyDown(key("ArrowUp"), el, ""); // → "third"
    expect(el.value).toBe("third");

    result.current.onKeyDown(key("ArrowUp"), el, el.value); // → "second"
    expect(el.value).toBe("second");

    result.current.onKeyDown(key("ArrowUp"), el, el.value); // → "first"
    expect(el.value).toBe("first");
  });

  it("stays at the oldest entry when ↑ is pressed at the boundary", () => {
    const { result } = renderHook(() => useHistoryRecall(LOG));
    const el = makeEl("");

    result.current.onKeyDown(key("ArrowUp"), el, ""); // third
    result.current.onKeyDown(key("ArrowUp"), el, el.value); // second
    result.current.onKeyDown(key("ArrowUp"), el, el.value); // first
    // One more ↑ at the boundary — no-op but still consumed.
    const e = key("ArrowUp");
    const consumed = result.current.onKeyDown(e, el, el.value);
    expect(consumed).toBe(true);
    expect(el.value).toBe("first");
  });
});

describe("useHistoryRecall — ArrowDown walks forward and restores buffer", () => {
  it("walks forward and restores the saved buffer past the newest entry", () => {
    const { result } = renderHook(() => useHistoryRecall(LOG));
    const el = makeEl("");

    result.current.onKeyDown(key("ArrowUp"), el, ""); // third
    result.current.onKeyDown(key("ArrowUp"), el, el.value); // second
    result.current.onKeyDown(key("ArrowDown"), el, el.value); // third again
    expect(el.value).toBe("third");

    // One more ↓ exits recall and restores the original empty buffer.
    result.current.onKeyDown(key("ArrowDown"), el, el.value);
    expect(el.value).toBe("");
  });

  it("calls onExit when exiting via ↓", () => {
    const onExit = vi.fn();
    const { result } = renderHook(() => useHistoryRecall(LOG, onExit));
    const el = makeEl("");

    result.current.onKeyDown(key("ArrowUp"), el, "");
    result.current.onKeyDown(key("ArrowDown"), el, el.value);
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("ArrowDown outside of recall is a no-op", () => {
    const { result } = renderHook(() => useHistoryRecall(LOG));
    const el = makeEl("some text");
    const e = key("ArrowDown");

    const consumed = result.current.onKeyDown(e, el, "some text");
    expect(consumed).toBe(false);
    expect(el.value).toBe("some text");
  });
});

describe("useHistoryRecall — Escape in recall", () => {
  it("restores the saved buffer and exits recall without consuming Escape", () => {
    const onExit = vi.fn();
    const { result } = renderHook(() => useHistoryRecall(LOG, onExit));
    const el = makeEl("");

    result.current.onKeyDown(key("ArrowUp"), el, ""); // enter recall
    expect(el.value).toBe("third");

    const e = key("Escape");
    const consumed = result.current.onKeyDown(e, el, el.value);
    expect(consumed).toBe(false); // Escape propagates
    expect(el.value).toBe(""); // buffer restored
    expect(onExit).toHaveBeenCalledOnce();
  });
});

describe("useHistoryRecall — printable key exits recall silently", () => {
  it("exits recall on a printable character without consuming the event", () => {
    const { result } = renderHook(() => useHistoryRecall(LOG));
    const el = makeEl("");

    result.current.onKeyDown(key("ArrowUp"), el, ""); // enter recall
    expect(el.value).toBe("third");

    const e = key("a"); // printable
    const consumed = result.current.onKeyDown(e, el, el.value);
    expect(consumed).toBe(false); // browser appends "a"

    // After exit, ↑ on an empty field should re-enter recall.
    el.value = "";
    const e2 = key("ArrowUp");
    const consumed2 = result.current.onKeyDown(e2, el, "");
    expect(consumed2).toBe(true);
  });
});

describe("useHistoryRecall — reset()", () => {
  it("resets cursor state so the next ↑ re-enters recall from scratch", () => {
    const { result } = renderHook(() => useHistoryRecall(LOG));
    const el = makeEl("");

    result.current.onKeyDown(key("ArrowUp"), el, ""); // enter recall (cursor=2)
    result.current.onKeyDown(key("ArrowUp"), el, el.value); // cursor=1

    result.current.reset();

    // After reset, ↑ on empty field should load the most-recent entry again.
    el.value = "";
    result.current.onKeyDown(key("ArrowUp"), el, "");
    expect(el.value).toBe("third");
  });
});
