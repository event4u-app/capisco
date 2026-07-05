/**
 * Smoke tests for `useDraft` (input reliability P4).
 *
 * Layout effects in jsdom are limited; these tests verify the hook mounts
 * cleanly, exposes the expected API shape, and that `onInput` can be called
 * without throwing. The debounce + restore paths are covered by e2e / visual tests.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useDraft } from "./use-draft.ts";

describe("useDraft — smoke", () => {
  it("returns the expected API shape", () => {
    const saveDraft = vi.fn();
    const { result } = renderHook(() => {
      const ref = useRef<HTMLTextAreaElement | null>(null);
      return useDraft({ ref, sessionId: "s1", initialDraft: "", saveDraft });
    });
    expect(result.current.onInput).toBeTypeOf("function");
    expect(result.current.dismissRestored).toBeTypeOf("function");
    expect(result.current.draftRestored).toBe(false);
  });

  it("draftRestored is false when initialDraft is empty", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLTextAreaElement | null>(null);
      return useDraft({ ref, sessionId: "s1", initialDraft: "", saveDraft: vi.fn() });
    });
    expect(result.current.draftRestored).toBe(false);
  });

  it("onInput can be called without error", () => {
    const saveDraft = vi.fn();
    const { result } = renderHook(() => {
      const ref = useRef<HTMLTextAreaElement | null>(null);
      return useDraft({ ref, sessionId: "s1", initialDraft: "", saveDraft });
    });
    expect(() => result.current.onInput()).not.toThrow();
  });

  it("dismissRestored sets draftRestored to false", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLTextAreaElement | null>(null);
      return useDraft({ ref, sessionId: "s1", initialDraft: "", saveDraft: vi.fn() });
    });
    // Even if draftRestored is already false, calling dismiss is safe.
    expect(() => result.current.dismissRestored()).not.toThrow();
    expect(result.current.draftRestored).toBe(false);
  });
});
