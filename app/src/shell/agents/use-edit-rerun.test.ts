/**
 * Edit-&-Rerun flag lifecycle (P5-A). The flag marks a buffer as a recalled
 * prompt so a send forks a "retry · edited" branch. It survives edits and clears
 * only on recall-exit or send.
 */

import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEditRerun, RERUN_BRANCH_LABEL } from "./use-edit-rerun.ts";

describe("useEditRerun", () => {
  it("starts inactive with a null branch label", () => {
    const { result } = renderHook(() => useEditRerun());
    expect(result.current.active).toBe(false);
    expect(result.current.branchLabel()).toBeNull();
  });

  it("activates on recall-enter and reports the branch label", () => {
    const { result } = renderHook(() => useEditRerun());
    result.current.onRecallEnter();
    expect(result.current.active).toBe(true);
    expect(result.current.branchLabel()).toBe(RERUN_BRANCH_LABEL);
  });

  it("clears on recall-exit", () => {
    const { result } = renderHook(() => useEditRerun());
    result.current.onRecallEnter();
    result.current.onRecallExit();
    expect(result.current.active).toBe(false);
    expect(result.current.branchLabel()).toBeNull();
  });

  it("clears on send", () => {
    const { result } = renderHook(() => useEditRerun());
    result.current.onRecallEnter();
    result.current.onSend();
    expect(result.current.active).toBe(false);
  });

  it("is referentially stable across re-renders", () => {
    const { result, rerender } = renderHook(() => useEditRerun());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
