import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { Command } from "@/shell/command-registry";
import { ALL_GROUPS, makeCommandProvider } from "@/lib/autocomplete/providers/command-provider";
import type { AutocompleteItem, AutocompleteProvider } from "@/lib/autocomplete/types";
import { MentionAutocomplete } from "./MentionAutocomplete";

/**
 * P1 integration: the `/`-command provider mounted on the SAME engine as
 * `@project`. Covers the council's trap list — `/` executes (excises the token),
 * a mid-line `/` does NOT open, `@project` is unaffected, and Cmd+Enter still
 * passes through to the host send handler while the overlay is open.
 */

const run = vi.fn();
function reg(): Record<string, Command> {
  return {
    "context:add": { id: "context:add", label: "Add context", group: "tools", run },
  };
}
function commandProviders(): AutocompleteProvider<AutocompleteItem>[] {
  return [
    makeCommandProvider({
      getRegistered: reg,
      groupFilter: ALL_GROUPS,
    }) as AutocompleteProvider<AutocompleteItem>,
  ];
}

describe("MentionAutocomplete + /command provider (P1)", () => {
  it("typing / at line-start opens the command list", async () => {
    const user = userEvent.setup();
    render(
      <MentionAutocomplete data-testid="composer-input" extraProviders={commandProviders()} />,
    );
    const input = screen.getByTestId<HTMLInputElement>("composer-input");
    await user.click(input);
    await user.type(input, "/add");
    expect(await screen.findByTestId("command-option-context:add")).toBeInTheDocument();
  });

  it("accepting a command executes it and excises the /query token", async () => {
    run.mockClear();
    const user = userEvent.setup();
    render(
      <MentionAutocomplete data-testid="composer-input" extraProviders={commandProviders()} />,
    );
    const input = screen.getByTestId<HTMLInputElement>("composer-input");
    await user.click(input);
    await user.type(input, "/add");
    await user.click(await screen.findByTestId("command-option-context:add"));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    // The /query token is removed — no command text is left in the buffer.
    expect(input.value).toBe("");
    expect(screen.queryByTestId("mention-listbox")).not.toBeInTheDocument();
  });

  it("a mid-line / (e.g. a path) does NOT open the command overlay", async () => {
    const user = userEvent.setup();
    render(
      <MentionAutocomplete data-testid="composer-input" extraProviders={commandProviders()} />,
    );
    const input = screen.getByTestId("composer-input");
    await user.click(input);
    await user.type(input, "see src/lib");
    expect(screen.queryByTestId("command-option-context:add")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mention-listbox")).not.toBeInTheDocument();
  });

  it("@project still routes correctly with a /command provider on the same engine", async () => {
    const user = userEvent.setup();
    render(
      <MentionAutocomplete
        data-testid="composer-input"
        currentProject="capisco"
        extraProviders={commandProviders()}
      />,
    );
    const input = screen.getByTestId("composer-input");
    await user.click(input);
    await user.type(input, "@core");
    expect(await screen.findByTestId("mention-option-core-api")).toBeInTheDocument();
    // The command provider did not hijack the @ trigger.
    expect(screen.queryByTestId("command-option-context:add")).not.toBeInTheDocument();
  });

  it("Cmd+Enter passes through to the host handler while the / overlay is open", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(
      <MentionAutocomplete
        data-testid="composer-input"
        extraProviders={commandProviders()}
        onKeyDown={onKeyDown}
      />,
    );
    const input = screen.getByTestId("composer-input");
    await user.click(input);
    await user.type(input, "/add");
    await screen.findByTestId("command-option-context:add");
    onKeyDown.mockClear();
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    // The overlay did not swallow Cmd+Enter — it reached the host send handler.
    expect(onKeyDown).toHaveBeenCalled();
  });
});
