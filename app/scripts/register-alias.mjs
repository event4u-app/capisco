/**
 * Registers the dev-only `@/` → `./src/` ESM resolve hook
 * (`scripts/alias-loader.mjs`) in the module-customization thread, so a bare
 * `node` process (the dev sidecar bridge) can resolve the path alias the way
 * vite/vitest does. NOT FOR PRODUCTION — dev plumbing only.
 *
 * Usage: `node --import ./scripts/register-alias.mjs <entry>.ts`
 */

import { register } from "node:module";

register("./alias-loader.mjs", import.meta.url);
