import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { MentionAutocomplete } from "./MentionAutocomplete";

/**
 * P0 engine guards (road-to-composer-intelligence): the shared-engine re-mount
 * of `@project` must not move the DOM (golden-cascade guard — the composer sits
 * inside full-page visual goldens), must accept on Tab (new engine key), and
 * must keep selection decoupled from navigation (insertion lands even though the
 * open-reference side-effect is a separate, opt-in step).
 */
describe("MentionAutocomplete — P0 engine guards", () => {
  it("keeps the DOM shape stable: input sits directly in a single `relative` wrapper", () => {
    const { container } = render(<MentionAutocomplete data-testid="composer-input" />);
    const input = screen.getByTestId("composer-input");
    const wrapper = input.parentElement!;
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.className).toContain("relative");
    // The wrapper is the component root — no extra nesting was introduced.
    expect(wrapper.parentElement).toBe(container);
    // On boot, neither overlay nor stale note is mounted (golden discipline).
    expect(screen.queryByTestId("mention-listbox")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mention-stale")).not.toBeInTheDocument();
  });

  it("accepts the highlighted item on Tab (new engine key)", async () => {
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
    await user.type(input, "@core-a");
    await screen.findByTestId("mention-option-core-api");
    await user.keyboard("{Tab}");
    await waitFor(() => expect(input.value).toBe("@core-api "));
    // Selection inserted the reference; navigation is the opt-in side-effect.
    expect(onOpenReference).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("mention-listbox")).not.toBeInTheDocument();
  });

  it("inserts the reference even when the open side-effect reports a stale path", async () => {
    // Decoupling: a failed/stale navigation never blocks the text insertion.
    const user = userEvent.setup();
    const onOpenReference = vi.fn(async () => false);
    render(
      <MentionAutocomplete
        data-testid="composer-input"
        currentProject="capisco"
        onOpenReference={onOpenReference}
      />,
    );
    const input = screen.getByTestId<HTMLInputElement>("composer-input");
    await user.click(input);
    await user.type(input, "@design");
    await user.click(await screen.findByTestId("mention-option-design-system"));
    // Insertion happened regardless of the side-effect outcome.
    await waitFor(() => expect(input.value).toBe("@design-system "));
    await screen.findByTestId("mention-stale");
  });
});
