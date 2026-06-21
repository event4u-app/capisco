/**
 * Quality-provider wiring (B5, road-to-quality-grounding). Registers the real
 * eslint/tsc/vitest runner on the registry under a stable id, plus the deferred
 * AI-review fake. The runner is the thin swap promised by the contracts — same
 * `quality` wire surface whether a real or fake review consumes its facts.
 *
 * Split posture (mirrors B2/B4): the QualityProvider's run/parse methods are
 * JSON-shaped and serialise over the wire. The AI-review fake is also pure +
 * serialisable; the *real* LLM provider (deferred) would keep its key in the
 * execution layer, never on the wire.
 */

import type { ProviderRegistry } from "./registry/registry.ts";
import { RealQualityProvider } from "./quality/real-quality-provider.ts";
import { FakeAiReviewProvider } from "./quality/fake-ai-review-provider.ts";

/** The quality-runner provider id on the wire. */
export const QUALITY_PROVIDER_ID = "quality";

/** The AI-review provider id on the wire (fake until a real LLM is wired). */
export const AI_REVIEW_PROVIDER_ID = "ai-review";

export function registerQuality(registry: ProviderRegistry): {
  quality: RealQualityProvider;
  aiReview: FakeAiReviewProvider;
} {
  const quality = new RealQualityProvider();
  const aiReview = new FakeAiReviewProvider();
  registry.register(QUALITY_PROVIDER_ID, quality as never);
  registry.register(AI_REVIEW_PROVIDER_ID, aiReview as never);
  return { quality, aiReview };
}
