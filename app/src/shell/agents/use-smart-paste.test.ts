/**
 * Unit tests for `useSmartPaste` (input reliability P4).
 *
 * The hook is a pure callback factory. Tests drive it with fake ClipboardEvent
 * objects that satisfy the interface the hook reads.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSmartPaste, type SmartPasteOptions } from "./use-smart-paste.ts";
import type React from "react";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

interface FakeItem {
  kind: string;
  type: string;
  getAsFile(): File | null;
}

interface FakeClipboardData {
  items: FakeItem[];
  getData(format: string): string;
}

function makeEvent(
  text: string,
  imageFile?: File,
): React.ClipboardEvent<HTMLTextAreaElement> & { defaultPrevented: boolean } {
  let prevented = false;

  const items: FakeItem[] = [];
  if (imageFile) {
    items.push({
      kind: "file",
      type: imageFile.type,
      getAsFile: () => imageFile,
    });
  }
  // Always add a text item so getData works even when an image is present.
  items.push({ kind: "string", type: "text/plain", getAsFile: () => null });

  const clipboardData: FakeClipboardData = {
    items,
    getData: (format: string) => (format === "text/plain" ? text : ""),
  };

  return {
    clipboardData: clipboardData as unknown as DataTransfer,
    preventDefault() {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    },
  } as unknown as React.ClipboardEvent<HTMLTextAreaElement> & {
    defaultPrevented: boolean;
  };
}

function makeOpts(overrides: Partial<SmartPasteOptions> = {}): SmartPasteOptions {
  return {
    onImage: vi.fn(),
    onUrl: vi.fn(),
    onLongText: vi.fn(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("useSmartPaste — image paste", () => {
  it("calls onImage and prevents default when an image file is pasted", () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useSmartPaste(opts));

    const imageFile = new File(["data"], "screenshot.png", { type: "image/png" });
    const e = makeEvent("", imageFile);

    result.current(e);

    expect(opts.onImage).toHaveBeenCalledOnce();
    expect(opts.onImage).toHaveBeenCalledWith("screenshot.png", imageFile);
    expect(e.defaultPrevented).toBe(true);
    expect(opts.onUrl).not.toHaveBeenCalled();
    expect(opts.onLongText).not.toHaveBeenCalled();
  });

  it("uses 'image.png' as fallback name when file.name is empty", () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useSmartPaste(opts));

    // Simulate a blob with no name (some browser paste paths produce this).
    const imageFile = new File(["data"], "", { type: "image/png" });
    const e = makeEvent("", imageFile);

    result.current(e);

    const [name] = (opts.onImage as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(name).toBe("image.png");
  });
});

describe("useSmartPaste — URL paste", () => {
  it("calls onUrl and prevents default for a bare https URL", () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useSmartPaste(opts));

    const e = makeEvent("https://example.com/some/path?q=1");

    result.current(e);

    expect(opts.onUrl).toHaveBeenCalledWith("https://example.com/some/path?q=1");
    expect(e.defaultPrevented).toBe(true);
    expect(opts.onImage).not.toHaveBeenCalled();
    expect(opts.onLongText).not.toHaveBeenCalled();
  });

  it("calls onUrl for a bare http URL", () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useSmartPaste(opts));

    const e = makeEvent("http://localhost:3000");
    result.current(e);

    expect(opts.onUrl).toHaveBeenCalledWith("http://localhost:3000");
    expect(e.defaultPrevented).toBe(true);
  });

  it("does NOT treat a URL with surrounding text as a bare URL", () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useSmartPaste(opts));

    const e = makeEvent("Check this out: https://example.com");
    result.current(e);

    expect(opts.onUrl).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });
});

describe("useSmartPaste — long text paste", () => {
  it("calls onLongText and prevents default when line count exceeds 30", () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useSmartPaste(opts));

    const text = Array.from({ length: 31 }, (_, i) => `line ${i}`).join("\n");
    const e = makeEvent(text);

    result.current(e);

    expect(opts.onLongText).toHaveBeenCalledWith(text);
    expect(e.defaultPrevented).toBe(true);
    expect(opts.onUrl).not.toHaveBeenCalled();
  });

  it("calls onLongText when character count exceeds 2 000", () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useSmartPaste(opts));

    const text = "x".repeat(2001); // single line, exceeds char threshold
    const e = makeEvent(text);

    result.current(e);

    expect(opts.onLongText).toHaveBeenCalledWith(text);
    expect(e.defaultPrevented).toBe(true);
  });
});

describe("useSmartPaste — short plain text falls through", () => {
  it("does nothing for short plain text (browser pastes normally)", () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useSmartPaste(opts));

    const e = makeEvent("Just a short message");
    result.current(e);

    expect(opts.onImage).not.toHaveBeenCalled();
    expect(opts.onUrl).not.toHaveBeenCalled();
    expect(opts.onLongText).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it("does nothing for empty clipboard text", () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useSmartPaste(opts));

    const e = makeEvent("");
    result.current(e);

    expect(opts.onImage).not.toHaveBeenCalled();
    expect(opts.onUrl).not.toHaveBeenCalled();
    expect(opts.onLongText).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });
});
