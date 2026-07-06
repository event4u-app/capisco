import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PermissionPrompt } from "./permission-prompt";
import { buildGrantPreview } from "@/lib/grant-preview";
import { mockPendingWrites } from "@/mocks/scoped-grant";

describe("PermissionPrompt — scoped bulk-run block (item 229)", () => {
  it("renders no scoped block when no grantPreview is passed (additive / golden-safe)", () => {
    render(<PermissionPrompt command="Write(x)" />);
    expect(screen.queryByTestId("permission-scoped")).toBeNull();
    // The standard scopes still render unchanged.
    expect(screen.getByTestId("permission-scope-0")).toBeInTheDocument();
  });

  it("renders covered + out-of-scope counts when a preview is passed", () => {
    const preview = buildGrantPreview(mockPendingWrites, "/repo/src/");
    render(<PermissionPrompt command="Write(x)" grantPreview={preview} />);
    expect(screen.getByTestId("permission-scoped-covered").textContent).toContain("3");
    expect(screen.getByTestId("permission-scoped-outofscope").textContent).toContain("1");
  });

  it("fires onGrantScoped with the prefix + suggested budget", async () => {
    const user = userEvent.setup();
    const onGrantScoped = vi.fn();
    const preview = buildGrantPreview(mockPendingWrites, "/repo/src/");
    render(
      <PermissionPrompt
        command="Write(x)"
        grantPreview={preview}
        onGrantScoped={onGrantScoped}
      />,
    );
    await user.click(screen.getByTestId("permission-scoped-grant"));
    expect(onGrantScoped).toHaveBeenCalledWith("/repo/src/", 3);
  });

  it("disables the grant button when nothing is covered", () => {
    const preview = buildGrantPreview([mockPendingWrites[3]!], "/repo/src/"); // only config/ → 0 covered
    render(<PermissionPrompt command="Write(x)" grantPreview={preview} />);
    expect(screen.getByTestId("permission-scoped-grant")).toBeDisabled();
  });
});
