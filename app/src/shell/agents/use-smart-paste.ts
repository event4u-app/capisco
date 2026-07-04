import type React from "react";
import { useCallback } from "react";

/** Number of lines above which a plain-text paste is treated as "long text". */
const LONG_PASTE_LINE_THRESHOLD = 30;
/** Number of characters above which a plain-text paste is treated as "long text". */
const LONG_PASTE_CHAR_THRESHOLD = 2000;
/** Matches a bare URL (http/https, no surrounding whitespace). */
const URL_PATTERN = /^https?:\/\/\S+$/;

/**
 * Callbacks for the three non-default paste paths (input reliability P4).
 * The consumer decides what to do with the intercepted payload.
 */
export interface SmartPasteOptions {
  /** Called when the user pastes an image file. */
  onImage(name: string, blob: Blob): void;
  /** Called when the pasted text is a bare URL. */
  onUrl(url: string): void;
  /** Called when the pasted text exceeds the line / character threshold. */
  onLongText(text: string): void;
}

/**
 * Returns a `onPaste` handler for `<textarea>` elements. Intercepts three
 * non-default cases (image, bare URL, long text) and falls through for
 * ordinary short-text pastes so the browser handles them normally.
 *
 * All inspection is **synchronous** — no async File reading is done here.
 */
export function useSmartPaste(
  opts: SmartPasteOptions,
): (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void {
  return useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const { clipboardData } = e;

      // 1. Image file item (drag-drop or screenshot paste).
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i]!;
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            opts.onImage((blob as File).name || "image.png", blob);
            return;
          }
        }
      }

      // 2. Plain text — check for bare URL or long-text threshold.
      const text = clipboardData.getData("text/plain");
      if (!text) return; // Nothing to intercept; let browser handle.

      const trimmed = text.trim();

      if (URL_PATTERN.test(trimmed)) {
        e.preventDefault();
        opts.onUrl(trimmed);
        return;
      }

      const lineCount = text.split("\n").length;
      if (lineCount > LONG_PASTE_LINE_THRESHOLD || text.length > LONG_PASTE_CHAR_THRESHOLD) {
        e.preventDefault();
        opts.onLongText(text);
        return;
      }

      // 3. Short text — fall through; the browser pastes normally.
    },
    // opts is spread-used inside; memoize on the stable identity of opts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts.onImage, opts.onUrl, opts.onLongText],
  );
}
