import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { MentionAutocomplete } from "./MentionAutocomplete";

/**
 * P2 integration: `@file`/`@folder` on the shared `@` trigger, MERGED with
 * `@project` in one overlay (the engine's collect-all-matching dispatch). File
 * source is the default mock `ProjectFsProvider.getTree` (MOCK_TREE). File pick
 * ingests through the broker (onAttachFile); folder pick is a reference only.
 */
describe("MentionAutocomplete + @file/@folder provider (P2)", () => {
  it("merges @project and @file items into one overlay on @", async () => {
    const user = userEvent.setup();
    render(
      <MentionAutocomplete
        data-testid="composer-input"
        currentProject="capisco"
        projectRoot="/repo"
        onAttachFile={vi.fn()}
      />,
    );
    const input = screen.getByTestId("composer-input");
    await user.click(input);
    await user.type(input, "@");
    // Both sources surface under the single `@` overlay.
    await waitFor(() =>
      expect(screen.getAllByTestId(/^mention-option-/).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByTestId(/^fs-option-/).length).toBeGreaterThan(0);
  });

  it("picks a file → inserts @name and attaches through the broker", async () => {
    const onAttachFile = vi.fn();
    const user = userEvent.setup();
    render(
      <MentionAutocomplete
        data-testid="composer-input"
        currentProject="capisco"
        projectRoot="/repo"
        onAttachFile={onAttachFile}
      />,
    );
    const input = screen.getByTestId<HTMLTextAreaElement>("composer-input");
    await user.click(input);
    await user.type(input, "@broker");
    await user.click(await screen.findByTestId("fs-option-broker.ts"));
    await waitFor(() => expect(input.value).toBe("@broker.ts "));
    expect(onAttachFile).toHaveBeenCalledWith("/repo/broker.ts");
  });

  it("picks a folder → inserts a reference, no broker attach", async () => {
    const onAttachFile = vi.fn();
    const user = userEvent.setup();
    render(
      <MentionAutocomplete
        data-testid="composer-input"
        currentProject="capisco"
        projectRoot="/repo"
        onAttachFile={onAttachFile}
      />,
    );
    const input = screen.getByTestId<HTMLTextAreaElement>("composer-input");
    await user.click(input);
    await user.type(input, "@src");
    await user.click(await screen.findByTestId("fs-option-src"));
    await waitFor(() => expect(input.value).toBe("@src "));
    expect(onAttachFile).not.toHaveBeenCalled();
  });

  it("without projectRoot, @file is disabled and @project is unaffected", async () => {
    const user = userEvent.setup();
    render(<MentionAutocomplete data-testid="composer-input" currentProject="capisco" />);
    const input = screen.getByTestId("composer-input");
    await user.click(input);
    await user.type(input, "@core");
    expect(await screen.findByTestId("mention-option-core-api")).toBeInTheDocument();
    expect(screen.queryByTestId(/^fs-option-/)).not.toBeInTheDocument();
  });
});
