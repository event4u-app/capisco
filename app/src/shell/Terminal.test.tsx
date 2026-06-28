import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import type { TerminalEvent } from "@/contracts";

/**
 * road-to-actually-works P6 — Terminal.tsx ↔ terminal-provider wiring.
 *
 * xterm.js needs real canvas/layout (absent in jsdom), so we mock it and assert
 * the BINDING (the autonomy gate per editor.spec.ts): each tab opens a PTY +
 * subscribes by id, provider output is written to xterm, xterm keystrokes are
 * forwarded to provider.write, and unmount reaps via provider.close. The real
 * xterm rendering + pixel goldens are the browser-side concern.
 */

// ---- mock xterm so the wiring runs in jsdom (no canvas/getContext) ----
// vi.hoisted: the class must exist before the hoisted vi.mock factory runs.
const { FakeXterm } = vi.hoisted(() => {
  class FakeXterm {
    static instances: FakeXterm[] = [];
    cols = 80;
    rows = 24;
    written: string[] = [];
    dataHandler: ((d: string) => void) | null = null;
    disposed = false;
    focused = false;
    constructor() {
      FakeXterm.instances.push(this);
    }
    loadAddon(): void {}
    open(): void {}
    write(d: string): void {
      this.written.push(d);
    }
    onData(cb: (d: string) => void): { dispose(): void } {
      this.dataHandler = cb;
      return { dispose: () => {} };
    }
    focus(): void {
      this.focused = true;
    }
    dispose(): void {
      this.disposed = true;
    }
  }
  return { FakeXterm };
});

vi.mock("@xterm/xterm", () => ({ Terminal: FakeXterm }));
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit(): void {}
  },
}));

import { Terminal } from "./Terminal.tsx";
import { getProviders } from "@/lib/desktop-shell";

const TAB_IDS = ["local", "py2ts", "evidence"];

describe("Terminal — xterm ↔ provider wiring", () => {
  let openSpy: ReturnType<typeof vi.spyOn>;
  let subSpy: ReturnType<typeof vi.spyOn>;
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let closeSpy: ReturnType<typeof vi.spyOn>;
  const listeners = new Map<string, (e: TerminalEvent) => void>();

  beforeEach(() => {
    FakeXterm.instances = [];
    listeners.clear();
    const term = getProviders().terminal;
    openSpy = vi.spyOn(term, "open");
    writeSpy = vi.spyOn(term, "write");
    closeSpy = vi.spyOn(term, "close");
    subSpy = vi.spyOn(term, "subscribe").mockImplementation((id, listener) => {
      listeners.set(id, listener);
      return () => listeners.delete(id);
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens a PTY and subscribes for every tab", () => {
    render(<Terminal />);
    for (const id of TAB_IDS) {
      expect(subSpy).toHaveBeenCalledWith(id, expect.any(Function));
      expect(openSpy).toHaveBeenCalledWith(expect.objectContaining({ id }));
    }
    expect(FakeXterm.instances).toHaveLength(TAB_IDS.length);
  });

  it("writes provider output into the matching xterm", () => {
    render(<Terminal />);
    // Drive a data event for the first tab → its xterm receives the bytes.
    listeners.get("local")!({ id: "local", kind: "data", data: "hello\r\n" });
    expect(FakeXterm.instances[0].written.join("")).toContain("hello\r\n");
  });

  it("forwards xterm keystrokes to provider.write", () => {
    render(<Terminal />);
    FakeXterm.instances[0].dataHandler!("ls\n");
    expect(writeSpy).toHaveBeenCalledWith("local", "ls\n");
  });

  it("renders an exit notice when the shell exits", () => {
    render(<Terminal />);
    listeners.get("local")!({ id: "local", kind: "exit", exitCode: 0, signal: null });
    expect(FakeXterm.instances[0].written.join("")).toContain("process exited");
  });

  it("reaps every PTY (provider.close + xterm.dispose) on unmount", () => {
    const { unmount } = render(<Terminal />);
    unmount();
    for (const id of TAB_IDS) expect(closeSpy).toHaveBeenCalledWith(id);
    expect(FakeXterm.instances.every((x) => x.disposed)).toBe(true);
  });
});
