// src/services/matching/engine.ts

import { createHash } from 'crypto'
import { logger } from '@/lib/logger'
import { redis } from '@/lib/redis'
import { getCached, CACHE_TAGS } from '@/lib/cache'
import { AppError, ErrorCodes } from '@/lib/errors'

import { getAdminSupabaseClient } from '@/lib/supabase/admin'

import {
  type ProfileForMatching,
  type MatchingWeights,
  type ScoreBreakdown,
  computeBreakdown,
  SCORE_VERSION,
} from './compatibility'
import { resolveReranker, type RerankContext } from './rerank'
import {
  applyDiversityCap,
  applyExploration,
  type RankedCandidate,
} from './ranking-policy'
import type { MatchReason } from './reasons'

export interface CandidateScore {
  candidateId: string
  score: number
  breakdown: ScoreBreakdown
  /** S16A — structured "why connect" facts, never fabricated free text. */
  reasons: MatchReason[]
  /** S038 pipeline metadata (additive — existing consumers unaffected). */
  rerankScore?: number
  rankOrigin?: 'structure' | 'diversity' | 'explore'
  /** Candidate features for the deterministic diversity reranker (additive). */
  skills?: string[]
  role?: string
}

export interface MatchingResult {
  candidates: CandidateScore[]
  /** Version of the scoring formula that produced these scores. */
  scoreVersion: string
  computedAt: string
  /** Pipeline metadata for observability + experiment artifacts. */
  pipeline?: {
    reranker: string
    scoreVersion: string
    eligibleCount: number
    rerankWindowK: number
    explorationSlots: number
  }
}

export const ALGORITHM_VERSION = 'mmm-rule-v1'

export const WEIGHTS_VERSION = 'v1'

const WEIGHT_KEYS: (keyof MatchingWeights)[] = [
  'skill',
  'intent',
  'role',
  'availability',
  'activity',
  'timezone',
  'diversity',
]

/**
 * #98 — strict weight validation. Every weight must be finite, in [0, 100],
 * and the seven weights must sum to exactly 100. Malformed weights must NEVER
 * become a silent production ranking change: callers fail fast instead.
 */
export function validateWeights(weights: MatchingWeights): MatchingWeights {
  let total = 0

  for (const key of WEIGHT_KEYS) {
    const value = weights[key]

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new AppError(
        ErrorCodes.INTERNAL,
        `Matching weight "${key}" must be a finite number (got ${String(value)}).`,
      )
    }

    if (value < 0 || value > 100) {
      throw new AppError(
        ErrorCodes.INTERNAL,
        `Matching weight "${key}" must be within [0, 100] (got ${value}).`,
      )
    }

    total += value
  }

  if (total !== 100) {
    throw new AppError(
      ErrorCodes.INTERNAL,
      `Matching weights must sum to 100 (got ${total}).`,
    )
  }

  return weights
}

function getDefaultWeights(): MatchingWeights {
  return validateWeights({
    skill: 25,
    intent: 20,
    role: 18,
    availability: 15,
    activity: 12,
    timezone: 10,
    diversity: 0,
  })
}

/**
 * #100 — pure eligibility check: determines whether a candidate can enter the
 * scoring pipeline. Exported for unit testing without infrastructure.
 */
export function isEligibleCandidate(
  reference: ProfileForMatching,
  candidate: ProfileForMatching,
): boolean {
  if (!candidate.id || candidate.id === reference.id) {
    return false
  }

  if (
    candidate.visibility === 'private' ||
    candidate.visibility === 'stealth'
  ) {
    return false
  }

  if (!candidate.role || !candidate.timezone) {
    return false
  }

  return true
}

/**
 * #100 — pure scorer: takes eligible candidates + weights, returns scored and
 * sorted results. No Redis, no cache, no eligibility filtering — fully
 * unit-testable without any infrastructure.
 */
export function scoreCandidates(
  reference: ProfileForMatching,
  eligibleCandidates: ProfileForMatching[],
  weights: MatchingWeights,
): CandidateScore[] {
  if (eligibleCandidates.length === 0) {
    return []
  }

  const results = eligibleCandidates.map((candidate) => {
    const breakdown = computeBreakdown(reference, candidate, weights)

    return {
      candidateId: candidate.id,
      score: breakdown.total,
      breakdown,
      reasons: generateReasons(reference, candidate),
      skills: candidate.skills,
      role: candidate.role,
    }
  })

  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }

    return a.candidateId.localeCompare(b.candidateId)
  })

  return results
}

export function computeScores(
  reference: ProfileForMatching,
  candidates: ProfileForMatching[],
  weights: MatchingWeights,
): CandidateScore[] {
  if (candidates.length === 0) {
    return []
  }

  const eligible = candidates.filter((c) => isEligibleCandidate(reference, c))

  return scoreCandidates(reference, eligible, weights)
}

function generateReasons(
  reference: ProfileForMatching,
  candidate: ProfileForMatching,
): MatchReason[] {
  // S16A — each reason is a REAL shared fact. The only fact provable from the
  // current profile inputs is a shared skill (normalised case-insensitive
  // overlap). We never infer direction for `intent_fit` from the aggregated
  // score, and never emit shared_idea/event/location without that data, so no
  // claim is ever invented. No fabricated "good overall match" fallback:
  // an empty list (nothing rendered) is honest when no shared skill exists.
  const mine = new Set(
    (reference.skills ?? [])
      .map((skill) => skill.trim().toLowerCase())
      .filter(Boolean),
  )

  const reasons: MatchReason[] = []

  for (const skill of candidate.skills ?? []) {
    const normalized = skill.trim().toLowerCase()
    if (normalized && mine.has(normalized)) {
      reasons.push({ type: 'shared_skill', skill: skill.trim() })
    }
  }

  return reasons
}

export type WeightsSource = 'db' | 'default' | 'fallback'

export interface ActiveMatchingConfig {
  weights: MatchingWeights
  /** Where the active weights came from. */
  source: WeightsSource
  weightsVersion: string
  algorithmVersion: string
}

export async function loadWeights(): Promise<MatchingWeights> {
  return (await getActiveConfig()).weights
}

/**
 * #99 — the active ranking configuration is always observable. Returns the
 * weights plus their provenance (source, versions). Falling back to defaults
 * — because matching_weights is empty OR because the stored weights are
 * invalid — is never silent: a high-severity config event is logged so
 * operations knows the experiment weights are not actually live.
 */
export async function getActiveConfig(): Promise<ActiveMatchingConfig> {
  const admin = getAdminSupabaseClient()

  if (!admin) {
    logger.error('Matching config: admin client unavailable; using defaults', {
      algorithmVersion: ALGORITHM_VERSION,
      weightsVersion: WEIGHTS_VERSION,
    })
    return {
      weights: getDefaultWeights(),
      source: 'fallback',
      weightsVersion: WEIGHTS_VERSION,
      algorithmVersion: ALGORITHM_VERSION,
    }
  }

  return getCached(
    async () => {
      const { data, error } = await admin
        .from('matching_weights')
        .select(
          'skill, intent, role, availability, activity, timezone, diversity',
        )
        .order('updated_at', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle()

      if (error || !data) {
        logger.error(
          'Matching config: matching_weights lookup failed; DEFAULTS ARE LIVE',
          {
            error: error?.message,
            algorithmVersion: ALGORITHM_VERSION,
            weightsVersion: WEIGHTS_VERSION,
          },
        )

        return {
          weights: getDefaultWeights(),
          source: 'fallback',
          weightsVersion: WEIGHTS_VERSION,
          algorithmVersion: ALGORITHM_VERSION,
        }
      }

      const dbWeights: MatchingWeights = {
        skill: data.skill ?? 25,
        intent: data.intent ?? 20,
        role: data.role ?? 18,
        availability: data.availability ?? 15,
        activity: data.activity ?? 12,
        timezone: data.timezone ?? 10,
        diversity: data.diversity ?? 0,
      }

      // #98 — fail fast on malformed stored weights. If the DB row is corrupt
      // we must not silently rank with it; the error surfaces so ops can fix
      // the row instead of believing the experiment is live.
      try {
        validateWeights(dbWeights)
      } catch (validationError) {
        logger.error('Matching config: stored weights INVALID; failing fast', {
          error:
            validationError instanceof Error
              ? validationError.message
              : String(validationError),
          algorithmVersion: ALGORITHM_VERSION,
          weightsVersion: WEIGHTS_VERSION,
        })
        throw validationError
      }

      return {
        weights: dbWeights,
        source: 'db',
        weightsVersion: WEIGHTS_VERSION,
        algorithmVersion: ALGORITHM_VERSION,
      }
    },
    {
      key: ['matching-weights'],
      tags: [CACHE_TAGS.matchingWeights],
      ttl: 300,
      useStampedeGuard: true,
    },
  )
}

export const RERANK_WINDOW_K = 50

/**
 * S038 bounded ranking pipeline:
 * hard eligibility → structured score (O(n)) → top-K (K≤50) →
 * semantic rerank (O(K)) → diversity cap → exploration quota →
 * deterministic tie-break → explanations.
 */
export function runRankingPipeline(
  reference: ProfileForMatching,
  eligible: ProfileForMatching[],
  weights: MatchingWeights,
  limit: number,
): {
  candidates: RankedCandidate[]
  pipeline: NonNullable<MatchingResult['pipeline']>
} {
  const scored = scoreCandidates(reference, eligible, weights)

  // Top-K window bound for the semantic stage.
  const k = Math.min(RERANK_WINDOW_K, scored.length)
  const window = scored.slice(0, k)

  const reranker = resolveReranker()
  const ctx: RerankContext = { reference, k }
  const reranked = reranker.rerank(window, ctx)

  const roleMap = new Map(eligible.map((c) => [c.id, c.role || 'other']))
  const roleOf = (id: string) => roleMap.get(id) ?? 'other'

  // Diversity re-rank bounded to the final window; keep full ordered list
  // (beyond limit) as exploration pool.
  const diversified = applyDiversityCap(reranked, { limit, roleOf })

  const selectedIds = new Set(diversified.map((c) => c.candidateId))
  const explorationPool = reranked.filter(
    (c) => !selectedIds.has(c.candidateId),
  )

  const withExploration = applyExploration(
    diversified,
    explorationPool,
    reference,
    roleOf,
  )

  // Deterministic tie-break on the final window (score desc, id asc),
  // exploration slots keep their position (appended at tail).
  const structural = withExploration.filter((c) => c.rankOrigin !== 'explore')
  structural.sort(
    (a, b) => b.score - a.score || a.candidateId.localeCompare(b.candidateId),
  )
  const explorationSlots = withExploration.filter(
    (c) => c.rankOrigin === 'explore',
  )

  return {
    candidates: [...structural, ...explorationSlots].slice(0, limit),
    pipeline: {
      reranker: reranker.name,
      scoreVersion: SCORE_VERSION,
      eligibleCount: eligible.length,
      rerankWindowK: k,
      explorationSlots: explorationSlots.length,
    },
  }
}

export async function getTopCandidates(
  userId: string,
  reference: ProfileForMatching,
  candidates: ProfileForMatching[],
  weights: MatchingWeights,
  limit = 10,
): Promise<MatchingResult> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50)

  // Fingerprints are sha256-truncated (#31): raw id-joins could exceed Redis
  // key limits once the pool grows; the hash preserves collision-free
  // distinction for any realistic pool while bounding key size.
  const candidateFingerprint = createHash('sha256')
    .update(
      candidates
        .map((candidate) => candidate.id)
        .filter(Boolean)
        .sort()
        .join(','),
    )
    .digest('hex')
    .slice(0, 24)

  const weightsFingerprint = createHash('sha256')
    .update(Object.values(weights).join(','))
    .digest('hex')
    .slice(0, 24)

  // v4: cache versioned by score version + pipeline/reranker contract (RULE:
  // version cache by model/weights/filter contract). A score bump invalidates
  // prior caches automatically because SCORE_VERSION is part of the key.
  const cacheKey = `recs:${SCORE_VERSION}:${resolveReranker().name}:${userId}:${safeLimit}:${candidateFingerprint}:${weightsFingerprint}`

  try {
    const cached = await redis.get(cacheKey)

    if (typeof cached === 'string') {
      const parsed = JSON.parse(cached) as MatchingResult

      if (
        Array.isArray(parsed.candidates) &&
        typeof parsed.computedAt === 'string'
      ) {
        return parsed
      }
    }
  } catch (error: unknown) {
    logger.warn('Matching cache read failed', {
      userId,
      error,
    })
  }

  const eligible = candidates.filter((c) => isEligibleCandidate(reference, c))
  const { candidates: ranked, pipeline } = runRankingPipeline(
    reference,
    eligible,
    weights,
    safeLimit,
  )

  // #32: TTL scales with pool size — a small eligible pool goes stale faster
  // (any new signup materially changes results) while a large pool is more
  // stable and can be cached longer. All bands stay within the p95 cache SLO.
  const ttlSeconds = Math.min(300, 30 + eligible.length * 2)

  const result: MatchingResult = {
    candidates: ranked,
    scoreVersion: SCORE_VERSION,
    computedAt: new Date().toISOString(),
    pipeline,
  }

  try {
    await redis.setex(cacheKey, ttlSeconds, JSON.stringify(result))
  } catch (error: unknown) {
    logger.warn('Matching cache write failed', {
      userId,
      error,
    })
  }

  return result
}
