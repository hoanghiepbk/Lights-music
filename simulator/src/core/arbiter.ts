import { PRIORITY_ORDER, type LightingRequest } from '@nhipsang/schema';

// Lighting Arbiter (TIP-004 §E, INV-6): pick the request whose source ranks
// highest in PRIORITY_ORDER (safety > hvac > music > theme). Nulls ignored.
// Deterministic and O(n): the first request at the best rank wins on ties.
export function arbitrate(requests: ReadonlyArray<LightingRequest | null>): LightingRequest | null {
  let best: LightingRequest | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const req of requests) {
    if (!req) continue;
    const rank = PRIORITY_ORDER.indexOf(req.source);
    if (rank >= 0 && rank < bestRank) {
      bestRank = rank;
      best = req;
    }
  }
  return best;
}
