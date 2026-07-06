/**
 * Native window-controls — browser-safe no-op contract
 * (road-to-shell-and-chat-really-work P0).
 *
 * The window buttons + titlebar drag are Tauri-v2 native. Outside Tauri (a plain
 * browser / jsdom) `isTauri()` is false and the helpers must be inert no-ops so
 * the offline web app is untouched. The capabilities-file ACL guard (that the
 * native permissions are granted) lives in the node-env sidecar suite
 * (`sidecar/test/tauri-capabilities.test.ts`).
 */

import { describe, expect, it } from "vitest";
import { isTauri, closeWindow, minimizeWindow, toggleMaximizeWindow } from "./window-controls";

describe("window-controls — browser-safe no-ops (isTauri false)", () => {
  it("isTauri() is false in a plain (non-Tauri) window", () => {
    expect(isTauri()).toBe(false);
  });

  it("close/minimize/toggleMaximize resolve without throwing outside Tauri", async () => {
    await expect(closeWindow()).resolves.toBeUndefined();
    await expect(minimizeWindow()).resolves.toBeUndefined();
    await expect(toggleMaximizeWindow()).resolves.toBeUndefined();
  });
});
