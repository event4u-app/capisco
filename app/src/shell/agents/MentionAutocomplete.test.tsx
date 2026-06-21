import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { RecentProject } from "@/contracts";
import { MentionAutocomplete } from "./MentionAutocomplete";

/**
 * DOM/routing test for the `@project` autocomplete (P1) against the seed
 * recent-projects registry (the default mock: capisco / core-api /
 * design-system). The list appears only on an `@` keypress; selecting an entry
 * inserts a canonical reference and fires the open-reference flow; a stale path
 * is surfaced quietly.
 */
describe("MentionAutocomplete (cross-project P1)", () => {
  it("does NOT show the list before an @ is typed", () => {
    render(<MentionAutocomplete data-testid="composer-input" />);
    expect(screen.queryByTestId("mention-listbox")).not.toBeInTheDocument();
  });

  it("surfaces matching projects from the seed registry on @", async () => {
    const user = userEvent.setup();
    render(<MentionAutocomplete data-testid="composer-input" currentProject="capisco" />);
    const input = screen.getByTestId("composer-input");
    await user.click(input);
    await user.type(input, "@core");
    expect(await screen.findByTestId("mention-option-core-api")).toBeInTheDocument();
    // The current project is excluded from suggestions.
    expect(screen.queryByTestId("mention-option-capisco")).not.toBeInTheDocument();
  });

  it("inserts a canonical @name reference and fires the open flow", async () => {
    const user = userEvent.setup();
    const opened: RecentProject[] = [];
    const onOpenReference = vi.fn(async (p: RecentProject) => {
      opened.push(p);
      return true; // path still exists
    });
    render(
      <MentionAutocomplete
        data-testid="composer-input"
        currentProject="capisco"
        onOpenReference={onOpenReference}
      />,
    );
    const input = screen.getByTestId<HTMLInputElement>("composer-input");
    await user.click(input);
    await user.type(input, "@core-a");
    await user.click(await screen.findByTestId("mention-option-core-api"));

    await waitFor(() => expect(input.value).toBe("@core-api "));
    expect(onOpenReference).toHaveBeenCalledTimes(1);
    expect(opened[0]?.name).toBe("core-api");
    // List closes after selection.
    expect(screen.queryByTestId("mention-listbox")).not.toBeInTheDocument();
  });

  it("handles a stale path quietly — soft note, no error spew", async () => {
    const user = userEvent.setup();
    const onOpenReference = vi.fn(async () => false); // path no longer exists
    render(
      <MentionAutocomplete
        data-testid="composer-input"
        currentProject="capisco"
        onOpenReference={onOpenReference}
      />,
    );
    const input = screen.getByTestId("composer-input");
    await user.click(input);
    await user.type(input, "@design");
    await user.click(await screen.findByTestId("mention-option-design-system"));

    const note = await screen.findByTestId("mention-stale");
    expect(note).toHaveTextContent("design-system");
    expect(note).toHaveAttribute("role", "status");
  });

  it("navigates with arrow keys and selects with Enter", async () => {
    const user = userEvent.setup();
    const onOpenReference = vi.fn(async () => true);
    render(
      <MentionAutocomplete
        data-testid="composer-input"
        currentProject="capisco"
        onOpenReference={onOpenReference}
      />,
    );
    const input = screen.getByTestId<HTMLInputElement>("composer-input");
    await user.click(input);
    await user.type(input, "@");
    // Wait for the seeded list (core-api + design-system, recency order).
    await screen.findByTestId("mention-listbox");
    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(onOpenReference).toHaveBeenCalledTimes(1));
  });
});
