import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeSymbolProvider } from "./symbol-provider";

// ---------------------------------------------------------------------------
// Mock desktop-shell — lsp.available controls whether the provider opens up.
// ---------------------------------------------------------------------------

const availableMock = vi.fn();

vi.mock("@/lib/desktop-shell", () => ({
  getProviders: () => ({
    lsp: { available: availableMock },
  }),
}));

beforeEach(() => {
  availableMock.mockReset();
});

// ---------------------------------------------------------------------------
// getItems — LSP unavailable (current production state)
// ---------------------------------------------------------------------------

describe("makeSymbolProvider — LSP unavailable", () => {
  it("returns [] and never throws when lsp.available resolves false", async () => {
    availableMock.mockResolvedValue(false);
    const p = makeSymbolProvider();
    const items = await p.getItems("anything");
    expect(items).toEqual([]);
  });

  it("uses languageId 'typescript' by default", async () => {
    availableMock.mockResolvedValue(false);
    const p = makeSymbolProvider();
    await p.getItems("");
    expect(availableMock).toHaveBeenCalledWith("typescript");
  });

  it("forwards a custom languageId to lsp.available", async () => {
    availableMock.mockResolvedValue(false);
    const p = makeSymbolProvider({ languageId: "python" });
    await p.getItems("");
    expect(availableMock).toHaveBeenCalledWith("python");
  });
});

// ---------------------------------------------------------------------------
// getItems — LSP available (future path, still [] today — real fetch deferred)
// ---------------------------------------------------------------------------

describe("makeSymbolProvider — LSP available (deferred real fetch)", () => {
  it("returns [] without throwing when lsp.available resolves true", async () => {
    availableMock.mockResolvedValue(true);
    const p = makeSymbolProvider();
    await expect(p.getItems("MyClass")).resolves.toEqual([]);
  });
});
