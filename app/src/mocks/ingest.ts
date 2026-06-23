import type { IngestOutcome, IngestProvider } from "@/contracts";
import {
  type DatasourceRoot,
  ingestDisplayName,
  looksLikeSecretPath,
  tagForPath,
} from "@/lib/sidecar/ingest-core";

/** A deterministic prod root for the browser demo / tests. */
const MOCK_DATASOURCES: readonly DatasourceRoot[] = [
  { prefix: "/exports/prod", name: "orders-db", prod: true },
];

/**
 * Browser / test ingestion fallback (B0). Runs the IDENTICAL secret-form +
 * source-tag screening as the host {@link BrokerIngestor} (shared
 * `ingest-core`), minus the host broker authorize/audit — the browser has no
 * real fs path to read, so there is nothing for the broker to gate. The desktop
 * IPC proxy routes to the real broker-gated ingestor instead.
 */
export const mockIngestProvider: IngestProvider = {
  ingestFile(path: string): Promise<IngestOutcome> {
    const displayName = ingestDisplayName(path);
    if (looksLikeSecretPath(path)) {
      return Promise.resolve({
        status: "refused",
        reason: "secret-form file — never ingested as context",
        displayName,
      });
    }
    return Promise.resolve({
      status: "reference",
      entry: { path, displayName, sourceTag: tagForPath(path, MOCK_DATASOURCES) },
    });
  },
};
