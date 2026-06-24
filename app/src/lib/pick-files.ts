/**
 * File-dialog seam (road-to-composer-context-runtime P1). The Composer's
 * `+`-Add / attach affordance picks files through THIS seam, never a raw
 * `<input>.click()` in the component — so the desktop host can swap a native
 * dialog in without the UI knowing (DesktopShell discipline, Decision-Gate
 * "Shell-Träger").
 *
 *  - **Desktop** — a host bridge injects `globalThis.__CAPISCO_SHELL__.pickFiles`
 *    (a Tauri file-dialog proxy). It returns real absolute `path`s, which the
 *    ingestion contract needs (path-reference + on-demand broker read).
 *  - **Browser** — no bridge → a hidden `<input type=file>` fallback. The
 *    browser File API exposes only the file NAME, never a real path, so picked
 *    files carry `name` only and `path` is undefined. Ingestion of such entries
 *    is a desktop-only capability (the contract's broker read needs a real path).
 *
 * Browser-safe by construction — never imports any node API.
 */

/** One picked file. `path` is present only on the desktop (real fs path). */
export interface PickedFile {
  /** Display name (always present). */
  name: string;
  /** Absolute filesystem path — desktop only; undefined in the browser. */
  path?: string;
}

export interface PickFilesOptions {
  multiple?: boolean;
}

/** The shape a desktop host injects to bridge the native file dialog. */
export interface ShellFileHost {
  pickFiles(opts: PickFilesOptions): Promise<PickedFile[]>;
}

function getShellHost(): ShellFileHost | undefined {
  return (globalThis as { __CAPISCO_SHELL__?: ShellFileHost }).__CAPISCO_SHELL__;
}

/** Whether a native desktop file-dialog bridge is present. */
export function hasDesktopFilePicker(): boolean {
  return typeof getShellHost()?.pickFiles === "function";
}

/**
 * Open the file picker and resolve with the chosen files. Desktop → native
 * dialog (real paths); browser → hidden `<input type=file>` (names only).
 * Resolves with `[]` when the user cancels.
 */
export function pickFiles(opts: PickFilesOptions = {}): Promise<PickedFile[]> {
  const host = getShellHost();
  if (host?.pickFiles) return host.pickFiles(opts);
  return browserPickFiles(opts);
}

/** Browser fallback — a transient hidden `<input type=file>`. */
function browserPickFiles(opts: PickFilesOptions): Promise<PickedFile[]> {
  if (typeof document === "undefined") return Promise.resolve([]);
  return new Promise<PickedFile[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (opts.multiple) input.multiple = true;
    input.style.display = "none";
    let settled = false;
    const finish = (files: PickedFile[]) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(files);
    };
    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []).map((f) => ({ name: f.name }));
      finish(files);
    });
    // `cancel` fires in modern browsers when the dialog is dismissed; older
    // engines simply never fire `change`, leaving the promise pending until the
    // input is GC'd — acceptable for a transient picker.
    input.addEventListener("cancel", () => finish([]));
    document.body.appendChild(input);
    input.click();
  });
}

/** Test/desktop hook: install a native picker bridge. */
export function installShellFileHost(host: ShellFileHost): void {
  (globalThis as { __CAPISCO_SHELL__?: ShellFileHost }).__CAPISCO_SHELL__ = host;
}

/** Test hook: clear any installed picker bridge (back to browser fallback). */
export function clearShellFileHost(): void {
  delete (globalThis as { __CAPISCO_SHELL__?: ShellFileHost }).__CAPISCO_SHELL__;
}
