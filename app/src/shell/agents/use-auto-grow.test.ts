/**
 * Smoke tests for `useAutoGrow` (input reliability P4).
 *
 * jsdom does not implement scrollHeight meaningfully, so these tests only
 * verify that the hook mounts without throwing and that `measure()` is
 * callable. The layout arithmetic is covered by the integration / visual tests.
 */

import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useAutoGrow } from "./use-auto-grow.ts";

describe("useAutoGrow — smoke", () => {
  it("mounts without error when ref is unattached", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLTextAreaElement | null>(null);
      return useAutoGrow(ref);
    });
    expect(result.current.measure).toBeTypeOf("function");
  });

  it("measure() is safe to call on an empty attached textarea", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLTextAreaElement | null>(null);
      // Attach a real jsdom element so the el != null branch runs.
      if (!ref.current) {
        const el = document.createElement("textarea");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ref as any).current = el;
      }
      return useAutoGrow(ref);
    });
    expect(() => result.current.measure()).not.toThrow();
  });
});
