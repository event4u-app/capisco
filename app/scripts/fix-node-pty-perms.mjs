/**
 * Ensure node-pty's prebuilt `spawn-helper` is executable (road-to-actually-works P6).
 *
 * node-pty ships per-platform prebuilds; on macOS/Linux it execs a companion
 * `spawn-helper` binary via posix_spawnp. Under pnpm the prebuild is extracted
 * WITHOUT the executable bit (pnpm ignores the package's build script by
 * default), so `pty.spawn` fails with `posix_spawnp failed.`. node-gyp-build
 * never recompiles when a matching prebuild exists, so the bit is never set.
 *
 * This postinstall restores it for the current platform/arch. Idempotent and
 * best-effort: a missing prebuild (e.g. Windows uses conpty, no spawn-helper)
 * is a clean no-op, never a failed install.
 */
import { chmodSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

try {
  const pkg = require.resolve("node-pty/package.json");
  const root = dirname(pkg);
  const helper = join(root, "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper");
  if (existsSync(helper)) {
    chmodSync(helper, 0o755);
    console.log(`[fix-node-pty-perms] chmod +x ${helper}`);
  }
} catch {
  // node-pty not installed (or no prebuild for this platform) — nothing to fix.
}
