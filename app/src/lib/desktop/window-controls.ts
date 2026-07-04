/**
 * Native window controls for the frameless Tauri shell (road-to-tauri-desktop-shell P3).
 *
 * The window runs with `decorations: false` so the 1:1-ported {@link TitleBar}
 * owns the chrome (traffic lights + drag region). In the browser these are
 * decorative and these helpers are inert; under Tauri they drive the real
 * window via `@tauri-apps/api/window`.
 *
 * Tauri-safe by construction: `@tauri-apps/api` is imported **dynamically**
 * inside each call and only after {@link isTauri} confirms the runtime, so the
 * browser/Vite bundle never evaluates it and the offline app stays untouched.
 */

/** Whether the app is running inside the Tauri webview (vs. a plain browser). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function appWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

/** Close the native window. No-op outside Tauri. */
export async function closeWindow(): Promise<void> {
  if (!isTauri()) return;
  await (await appWindow()).close();
}

/** Minimize the native window. No-op outside Tauri. */
export async function minimizeWindow(): Promise<void> {
  if (!isTauri()) return;
  await (await appWindow()).minimize();
}

/** Toggle maximize/unmaximize the native window. No-op outside Tauri. */
export async function toggleMaximizeWindow(): Promise<void> {
  if (!isTauri()) return;
  await (await appWindow()).toggleMaximize();
}
