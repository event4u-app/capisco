/**
 * TitleBar window-control wiring (road-to-shell-and-chat-really-work P0).
 *
 * Under Tauri the traffic lights are REAL buttons that drive the native window;
 * in the browser they are decorative spans. This pins both — the click→control
 * wiring (with the native runtime mocked) and the browser-decorative fallback.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";

let tauri = true;
vi.mock("@/lib/desktop/window-controls", () => ({
  isTauri: () => tauri,
  closeWindow: vi.fn(),
  minimizeWindow: vi.fn(),
  toggleMaximizeWindow: vi.fn(),
}));

import { TitleBar } from "./TitleBar";
import {
  closeWindow,
  minimizeWindow,
  toggleMaximizeWindow,
} from "@/lib/desktop/window-controls";

function renderBar() {
  render(
    <ThemeProvider>
      <TitleBar />
    </ThemeProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("TitleBar traffic lights", () => {
  it("under Tauri: close/minimize/maximize are buttons that drive the native window", async () => {
    tauri = true;
    const user = userEvent.setup();
    renderBar();
    const buttons = document.querySelectorAll(".tb-traffic button.tl");
    expect(buttons).toHaveLength(3);
    await user.click(document.querySelector(".tb-traffic .tl-r")!);
    await user.click(document.querySelector(".tb-traffic .tl-y")!);
    await user.click(document.querySelector(".tb-traffic .tl-g")!);
    expect(closeWindow).toHaveBeenCalledOnce();
    expect(minimizeWindow).toHaveBeenCalledOnce();
    expect(toggleMaximizeWindow).toHaveBeenCalledOnce();
  });

  it("in the browser (isTauri false): the lights are decorative spans, not buttons", () => {
    tauri = false;
    renderBar();
    expect(document.querySelectorAll(".tb-traffic button.tl")).toHaveLength(0);
    expect(document.querySelectorAll(".tb-traffic span.tl")).toHaveLength(3);
  });

  it("the titlebar carries the Tauri drag region", () => {
    tauri = true;
    renderBar();
    expect(screen.getByTestId("titlebar")).toHaveAttribute("data-tauri-drag-region");
  });
});
