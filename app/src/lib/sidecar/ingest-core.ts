/**
 * Pure context-ingestion screening (road-to-composer-context-runtime P2).
 *
 * Lives under `src/lib/sidecar/` so BOTH sides import the SAME logic — the
 * host-side {@link BrokerIngestor} (the real broker-gated chokepoint) and the
 * browser-side `mockIngestProvider` fallback. There is exactly one
 * secret-form + source-tag implementation; the broker only adds the
 * authorize/audit execution layer on top.
 *
 * Browser-safe: no node, no broker import — pure string predicates.
 */

import type { ContextSourceTag } from "@/contracts";

/** Secret key/cert extensions. */
const SECRET_EXT = /\.(?:key|pem|pfx|p12|asc|keystore|jks)$/i;
/** Secret dotfiles / dirs (`.env`, `.env.production`, `.ssh/`, `.aws/`, …). */
const SECRET_DOTFILE = /(?:^|[/\\])\.(?:env|ssh|aws|npmrc|netrc|pgpass)(?:[/\\.]|$)/i;
/** Credential / secret / key-pair filenames, boundary-anchored (no `secretary`). */
const SECRET_NAME = /(?:^|[/\\._-])(?:credentials?|secrets?|id_rsa|id_ed25519)(?:$|[/\\._-])/i;
/** Value-shaped markers embedded in a path (`key=`, `token`, `Authorization:`). */
const SECRET_VALUE = /[:=]|\b(?:password|passwd|secret|token|apikey|api[_-]?key|bearer|authorization)\b/i;

/** Whether a path is secret-shaped and must never be ingested as context. */
export function looksLikeSecretPath(path: string): boolean {
  return (
    SECRET_EXT.test(path) ||
    SECRET_DOTFILE.test(path) ||
    SECRET_NAME.test(path) ||
    SECRET_VALUE.test(path)
  );
}

/** A datasource root: files under `prefix` are tagged `prod:`/`datasource:`. */
export interface DatasourceRoot {
  /** Absolute path prefix that marks a file as datasource-derived. */
  prefix: string;
  /** Datasource name carried into the tag. */
  name: string;
  /** Production datasource → `prod:<name>` (structurally read-only). */
  prod: boolean;
}

const norm = (s: string) => s.replace(/\\/g, "/").replace(/\/+$/, "");

function underPrefix(path: string, prefix: string): boolean {
  const p = norm(path);
  const pre = norm(prefix);
  return p === pre || p.startsWith(pre + "/");
}

/** Origin tag, set at the ingestion boundary (re-checked at read). */
export function tagForPath(path: string, datasources: readonly DatasourceRoot[]): ContextSourceTag {
  for (const ds of datasources) {
    if (underPrefix(path, ds.prefix)) {
      return ds.prod ? `prod:${ds.name}` : `datasource:${ds.name}`;
    }
  }
  return "local";
}

/** The basename for a chip's display label. */
export function ingestDisplayName(path: string): string {
  const parts = path.replace(/[/\\]+$/, "").split(/[/\\]/);
  return parts[parts.length - 1] || path;
}
