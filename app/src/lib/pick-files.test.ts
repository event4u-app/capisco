import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearShellFileHost,
  hasDesktopFilePicker,
  installShellFileHost,
  pickFiles,
} from "./pick-files";

afterEach(() => {
  clearShellFileHost();
  document.body.innerHTML = "";
});

describe("pick-files seam (composer-context-runtime P1)", () => {
  it("routes to the desktop host bridge when present (real paths)", async () => {
    const host = {
      pickFiles: vi
        .fn()
        .mockResolvedValue([{ name: "broker.ts", path: "/repo/src/broker.ts" }]),
    };
    installShellFileHost(host);
    expect(hasDesktopFilePicker()).toBe(true);

    const files = await pickFiles({ multiple: true });
    expect(host.pickFiles).toHaveBeenCalledWith({ multiple: true });
    expect(files).toEqual([{ name: "broker.ts", path: "/repo/src/broker.ts" }]);
  });

  it("falls back to a hidden <input type=file> in the browser (no host)", async () => {
    expect(hasDesktopFilePicker()).toBe(false);
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});

    const promise = pickFiles({ multiple: true });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.multiple).toBe(true);
    expect(clickSpy).toHaveBeenCalled();

    // No files chosen → change with empty list resolves [] and removes the input.
    input.dispatchEvent(new Event("change"));
    await expect(promise).resolves.toEqual([]);
    expect(document.querySelector('input[type="file"]')).toBeNull();
    clickSpy.mockRestore();
  });

  it("resolves [] when the browser dialog is cancelled", async () => {
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const promise = pickFiles();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    input.dispatchEvent(new Event("cancel"));
    await expect(promise).resolves.toEqual([]);
  });
});
