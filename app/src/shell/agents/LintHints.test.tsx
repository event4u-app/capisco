/**
 * LintHints (composer-intelligence S3) — advisory prompt-lint row. Boot-invisible:
 * an empty buffer renders nothing, so the composer goldens are unaffected.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LintHints } from "./LintHints";

describe("LintHints", () => {
  it("renders nothing for an empty buffer (boot-invisible)", () => {
    const { container } = render(<LintHints value="" hasAttachments={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a hint row when a rule fires", () => {
    render(<LintHints value="fix" hasAttachments={false} />);
    expect(screen.getByTestId("composer-lints")).toBeInTheDocument();
    expect(screen.getByTestId("composer-lint-too-short")).toBeInTheDocument();
  });

  it("carries the severity as a data attribute", () => {
    render(<LintHints value="fix the bug now" hasAttachments={false} />);
    expect(screen.getByTestId("composer-lint-vague-imperative")).toHaveAttribute(
      "data-severity",
      "warn",
    );
  });

  it("softens when context is attached", () => {
    render(<LintHints value="fix the bug now" hasAttachments={true} />);
    expect(screen.queryByTestId("composer-lint-vague-imperative")).not.toBeInTheDocument();
  });
});
