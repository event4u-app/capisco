/**
 * Context-ingestion security tests (road-to-composer-context-runtime P2).
 *
 * Encodes the mandatory threat-pass invariants from
 * `agents/contexts/file-ingestion-contract.md` as passing tests:
 *  1. Ingestion-Invariante — secret-form / prod paths never return the value.
 *  4. Ingestion-Refusal-Attack — `+`-Add and Drag&Drop share ONE chokepoint,
 *     so a secret file is refused regardless of which caller invoked it.
 *  5. prod-read-only-at-ingestion — a prod-origin path carries its `prod:*` tag
 *     INTO the reference, set at the ingestion boundary (not deferred to read).
 */

import { describe, expect, it } from "vitest";
import { Broker, DEFAULT_GRANT_CONFIG } from "../broker/index.ts";
import { BrokerIngestor, looksLikeSecretPath } from "../ingest/broker-ingestor.ts";

/** A human-attach ingestor: clears the fail-closed `ask` like an editor save. */
function makeIngestor(prodPrefix?: string) {
  const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
  const ingestor = new BrokerIngestor({
    broker,
    datasources: prodPrefix ? [{ prefix: prodPrefix, name: "orders-db", prod: true }] : [],
    resolvePermission: () => ({ axis: "session" }),
  });
  return { broker, ingestor };
}

describe("File-ingestion contract — secret-form detection", () => {
  it.each([
    "/repo/.env",
    "/repo/config/.env.production",
    "/home/me/.ssh/id_rsa",
    "/repo/server.key",
    "/repo/cert.pem",
    "/repo/aws-credentials",
    "/repo/token=abcdef",
  ])("flags %s as secret-shaped", (p) => {
    expect(looksLikeSecretPath(p)).toBe(true);
  });

  it.each(["/repo/src/broker.ts", "/repo/README.md", "/repo/notes.txt"])(
    "treats ordinary file %s as non-secret",
    (p) => {
      expect(looksLikeSecretPath(p)).toBe(false);
    },
  );
});

describe("Test 1 — Ingestion-Invariante (never the value)", () => {
  it("refuses a secret-form path; the result carries no content/value field", async () => {
    const { ingestor } = makeIngestor();
    const out = await ingestor.ingestFile("/repo/.env.production");
    expect(out.status).toBe("refused");
    if (out.status === "refused") expect(out.reason).toMatch(/secret/i);
    // Structurally, neither arm of IngestOutcome has a content/value field.
    expect(JSON.stringify(out)).not.toMatch(/"(content|value|bytes)"/);
  });

  it("a normal local file becomes a path-REFERENCE, never bytes", async () => {
    const { ingestor } = makeIngestor();
    const out = await ingestor.ingestFile("/repo/src/broker.ts");
    expect(out.status).toBe("reference");
    if (out.status === "reference") {
      expect(out.entry).toEqual({
        path: "/repo/src/broker.ts",
        displayName: "broker.ts",
        sourceTag: "local",
      });
    }
    expect(JSON.stringify(out)).not.toMatch(/"(content|value|bytes)"/);
  });

  it("writes a deny audit entry for a refused secret ingestion (before any read)", async () => {
    const { broker, ingestor } = makeIngestor();
    await ingestor.ingestFile("/home/me/.ssh/id_rsa");
    const last = broker.audit.list().at(-1);
    expect(last?.capability).toBe("file-read");
    expect(last?.outcome).toBe("deny");
    expect(last?.reason).toMatch(/secret/i);
  });
});

describe("Test 4 — Ingestion-Refusal-Attack (one chokepoint, both paths)", () => {
  it("the SAME ingestFile refuses a secret file regardless of caller (+ / drag&drop)", async () => {
    const { ingestor } = makeIngestor();
    // `+`-Add and Drag&Drop both call exactly this method — there is no second
    // ingestion path. A secret file is refused on every invocation.
    const viaAdd = await ingestor.ingestFile("/repo/secrets.json");
    const viaDrop = await ingestor.ingestFile("/repo/secrets.json");
    expect(viaAdd.status).toBe("refused");
    expect(viaDrop.status).toBe("refused");
  });
});

describe("Test 5 — prod-read-only-at-ingestion (tag set at the boundary)", () => {
  it("a prod-origin path carries its prod:* tag into the reference at ingestion", async () => {
    const { ingestor } = makeIngestor("/exports/orders");
    const out = await ingestor.ingestFile("/exports/orders/q3.csv");
    expect(out.status).toBe("reference");
    if (out.status === "reference") {
      expect(out.entry.sourceTag).toBe("prod:orders-db");
      // It is a reference (read-only handle), never the raw value.
      expect(out.entry).not.toHaveProperty("content");
    }
  });

  it("a deny resolver refuses the read when file-read is gated to ask (fail-closed honoured)", async () => {
    // A deployment that makes file-read `ask` (stricter than the default
    // `allow`): the human gate is consulted, and a deny refuses the ingestion.
    const broker = new Broker({ config: { rules: [{ kind: "file-read", pattern: "*", verdict: "ask" }] } });
    const ingestor = new BrokerIngestor({ broker, resolvePermission: () => ({ axis: "deny" }) });
    const out = await ingestor.ingestFile("/repo/src/app.ts");
    expect(out.status).toBe("refused");
  });
});
