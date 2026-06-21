import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { ProjectSwitcher } from "./ProjectSwitcher";

describe("ProjectSwitcher (B0 Phase 2)", () => {
  it("renders the current project name in the trigger", () => {
    render(<ProjectSwitcher current="capisco" />);
    expect(screen.getByTestId("project-switcher")).toHaveTextContent("capisco");
  });

  it("surfaces other instances'/projects' entries from the recent registry", async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher current="capisco" />);
    await user.click(screen.getByTestId("project-switcher"));
    // The mock registry seeds two other projects (core-api, design-system).
    expect(await screen.findByTestId("recent-project-core-api")).toBeInTheDocument();
    expect(screen.getByTestId("recent-project-design-system")).toBeInTheDocument();
    // The current project is not listed as "other".
    expect(screen.queryByTestId("recent-project-capisco")).not.toBeInTheDocument();
  });

  it("shows the per-entry branch from the registry", async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher current="capisco" />);
    await user.click(screen.getByTestId("project-switcher"));
    const entry = await screen.findByTestId("recent-project-core-api");
    expect(entry).toHaveTextContent("feat/broker");
  });
});
