// @vitest-environment node
/**
 * Tauri v2 capabilities ACL guard (road-to-shell-and-chat-really-work P0).
 *
 * The native window controls (min/max/close) + titlebar drag are IPC commands the
 * v2 ACL must explicitly grant. `core:default` is a READ-ONLY window set — without
 * the state-mutating + start-dragging permissions the calls reject silently and
 * the buttons "do nothing" (the exact reported bug). This locks the fix so it
 * cannot regress. (Lives in the node suite because it reads the src-tauri config.)
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const capabilities = JSON.parse(
  readFileSync(join(here, "../../src-tauri/capabilities/default.json"), "utf8"),
) as { windows: string[]; permissions: string[] };

describe("Tauri capabilities — window controls are ACL-granted", () => {
  it("targets the `main` window", () => {
    expect(capabilities.windows).toContain("main");
  });

  it("grants the state-mutating window permissions + start-dragging", () => {
    for (const perm of [
      "core:window:allow-minimize",
      "core:window:allow-maximize",
      "core:window:allow-unmaximize",
      "core:window:allow-toggle-maximize",
      "core:window:allow-close",
      "core:window:allow-start-dragging",
    ]) {
      expect(capabilities.permissions).toContain(perm);
    }
  });
});
