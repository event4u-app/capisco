import { describe, expect, it } from "vitest";
import i18n from "./index";

// Backstop against missing translations: every key the UI references must
// resolve to something other than the key itself.
const REQUIRED_KEYS = [
  "app.tagline",
  "theme.toggle",
  "broker.approvalRequired",
  "broker.scope.allowOnce",
  "broker.scope.thisSession",
  "broker.scope.deny",
];

describe("i18n", () => {
  it("initializes with the en namespace", () => {
    expect(i18n.language).toBe("en");
  });

  it("resolves every required key (no missing translations)", () => {
    for (const key of REQUIRED_KEYS) {
      expect(i18n.t(key), `missing translation: ${key}`).not.toBe(key);
    }
  });
});
