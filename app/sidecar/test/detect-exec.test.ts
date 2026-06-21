// @vitest-environment node
/**
 * Detect primitive test (B8 P0). The read-only `which`/`--version` probe:
 *  - resolves a real binary (`node`) on PATH and reads a version,
 *  - returns undefined for a binary that is not installed,
 *  - REFUSES a mutating arg (it can never be repurposed as an install path).
 */

import { describe, expect, it } from "vitest";
import { probeVersion, resolveBinaryPath } from "../provision/detect-exec.ts";

describe("detect-exec — read-only host probe", () => {
  it("resolves an installed binary on PATH", () => {
    // `node` is running this test, so it is on PATH by construction.
    expect(resolveBinaryPath("node")).toBeTruthy();
  });

  it("returns undefined for a binary that is not installed", () => {
    expect(resolveBinaryPath("capisco-definitely-not-a-real-binary-xyz")).toBeUndefined();
  });

  it("reads a version for an installed binary", async () => {
    const v = await probeVersion("node", ["--version"]);
    expect(v).toMatch(/^v?\d+\./);
  });

  it("returns undefined (no spawn) for a missing binary version probe", async () => {
    const v = await probeVersion("capisco-definitely-not-a-real-binary-xyz");
    expect(v).toBeUndefined();
  });

  it("REFUSES a mutating arg — the primitive is read-only by construction", async () => {
    await expect(probeVersion("npm", ["install", "left-pad"])).rejects.toThrow(/mutating/);
    await expect(probeVersion("npm", ["i", "left-pad"])).rejects.toThrow(/mutating/);
  });
});
