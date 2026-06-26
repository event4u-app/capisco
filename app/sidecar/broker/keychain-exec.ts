/**
 * macOS keychain exec primitive (road-to-real-breadth P0).
 *
 * The single audited home for the `security` calls the KeychainSecretStore uses.
 * Posture mirrors git-exec.ts / docker-exec.ts: NEVER through a shell — execFile
 * with a discrete argv array.
 *
 * "No garbage" is structural: ALL items live under ONE service namespace
 * (`capisco` by default), and add uses `-U` (update-or-add) so re-storing a ref
 * NEVER creates a duplicate keychain item. A `deleteItem` + the store's index let
 * us enumerate and clean up exactly our entries — nothing else is touched.
 *
 * Note: `security add-generic-password -w <value>` passes the value in argv
 * (briefly visible to `ps` on the same machine). That is the only API macOS
 * offers non-interactively; on a single-user dev box with the user's OWN token
 * it is acceptable. The file fallback (FileSecretStore) avoids argv entirely.
 */

import { execFile } from "node:child_process";

const TIMEOUT_MS = 5000;
const MAX_BUFFER = 256 * 1024;

function run(args: readonly string[]): Promise<{ ok: boolean; stdout: string; code: number | null }> {
  return new Promise((resolve) => {
    execFile("security", [...args], { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, encoding: "utf8" }, (err, stdout) => {
      const code = err && typeof (err as { code?: unknown }).code === "number" ? (err as { code: number }).code : err ? 1 : 0;
      resolve({ ok: !err, stdout: `${stdout}`, code });
    });
  });
}

/** True on macOS with a working `security` CLI. */
export async function keychainAvailable(): Promise<boolean> {
  if (process.platform !== "darwin") return false;
  const r = await run(["help"]);
  return r.ok || r.code === 0 || r.code === 2; // `security help` exits 2 but proves presence
}

/** Add or UPDATE (no duplicate) a generic-password item under `service`/`account`. */
export async function keychainPut(service: string, account: string, value: string): Promise<void> {
  const r = await run(["add-generic-password", "-U", "-s", service, "-a", account, "-w", value]);
  if (!r.ok) throw new Error(`keychain put failed for ${service}/${account} (code ${r.code})`);
}

/** Read a value (stdout); undefined when the item does not exist. */
export async function keychainGet(service: string, account: string): Promise<string | undefined> {
  const r = await run(["find-generic-password", "-s", service, "-a", account, "-w"]);
  if (!r.ok) return undefined;
  return r.stdout.replace(/\n$/, "");
}

/** Delete one item. Idempotent (missing item is not an error for the caller). */
export async function keychainDelete(service: string, account: string): Promise<void> {
  await run(["delete-generic-password", "-s", service, "-a", account]);
}
