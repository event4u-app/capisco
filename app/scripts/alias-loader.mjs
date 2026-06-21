/**
 * Node ESM resolve hook (dev-only). Two jobs, both mirroring what
 * vite/vitest do for this codebase but bare Node does not:
 *
 *  1. Map the `@/` path alias to `./src/` (the `vite.config.ts` / tsconfig
 *     `paths` entry).
 *  2. Resolve EXTENSIONLESS relative + alias imports to `.ts`/`.tsx`/`/index.ts`
 *     — the `src/` tree (contracts, mocks) is authored bundler-style with
 *     extensionless relative imports, which bare Node cannot resolve.
 *
 * This lets the dev sidecar bridge (and `pnpm dev:sidecar`) run on bare Node 25
 * (type-stripping) with no new dependency. node_modules / builtin specifiers
 * fall straight through to the default resolver. NOT FOR PRODUCTION — the Tauri
 * shell bundles its own resolution; this is dev plumbing.
 *
 * Loaded in the module-customization thread via `scripts/register-alias.mjs`.
 */

import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC_URL = new URL("../src/", import.meta.url).href;

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Try exact, then `.ts`/`.tsx`, then `/index.ts`/`/index.tsx` for a file URL. */
function resolveToFile(url) {
  const path = fileURLToPath(url);
  if (existsSync(path) && statSync(path).isFile()) return pathToFileURL(path).href;
  for (const ext of [".ts", ".tsx"]) {
    if (isFile(path + ext)) return pathToFileURL(path + ext).href;
  }
  for (const idx of ["/index.ts", "/index.tsx"]) {
    if (isFile(path + idx)) return pathToFileURL(path + idx).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // 1. `@/` alias → src/, with bundler-style extension/index resolution.
  if (specifier === "@" || specifier.startsWith("@/")) {
    const rest = specifier === "@" ? "" : specifier.slice(2);
    const hit = resolveToFile(new URL(rest, SRC_URL));
    if (hit) return { url: hit, shortCircuit: true };
  }
  // 2. Extensionless RELATIVE import whose parent is a file URL — resolve it
  //    bundler-style against the importing module.
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const hasExt = /\.[mc]?[jt]sx?$/.test(specifier) || /\.json$/.test(specifier);
    if (!hasExt) {
      const hit = resolveToFile(new URL(specifier, context.parentURL));
      if (hit) return { url: hit, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
