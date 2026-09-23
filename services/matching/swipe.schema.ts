// src/services/matching/swipe.schema.ts
import { z } from 'zod'
import { uuidSchema } from '@/lib/validation'

// ─── Swipe action schema ───────────────────────────────
// Sessions 17 + 17A — opaque recommendation identity plus action.
// HOST-DB-02 — the compatibility score is no longer client-supplied. The
// discover pipeline persists it server-side into recommendation_scores and
// the perform_swipe RPC derives it from there. No score field here.
export const swipeSchema = z
  .object({
    // The candidate is STILL sent (the RPC needs the row address +
    // self-swipe guard), but it is cross-checked against the snapshot's
    // bound candidate — a mismatch is RECOMMENDATION_INVALID.
    candidateId: uuidSchema,
    action: z.enum(['like', 'pass', 'spark']),
    // S17 — opaque per-card snapshot minted by getDiscoverBatch (HMAC, server
    // authority). The browser echoes it; the server verifies owner, candidate,
    // epoch, expiry, and score version before the mutation.
    recommendationId: z.string().min(1, 'Recommendation is required'),
    // S17 — idempotency key minted per swipe gesture (uuid). Retries of the
    // same gesture replay the same id; the server memoizes the served result
    // and returns it instead of mutating twice.
    clientIntentId: uuidSchema,
  })
  .strict()

export type SwipeInput = z.infer<typeof swipeSchema>

// ─── perform_swipe RPC result schema ───────────────────
// Postgres returns jsonb_build_object(...) — validate before trusting it.
// quota_remaining is server-authoritative (P0-10): 10 - used after this
// swipe for like/spark, live remainder for pass.
export const swipeResultSchema = z
  .object({
    match_created: z.boolean(),
    match_id: z.string().uuid().nullable(),
    quota_remaining: z.number().int().min(0).max(10).nullable(),
  })
  .strict()

export type SwipeResult = z.infer<typeof swipeResultSchema>
