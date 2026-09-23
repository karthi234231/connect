// src/services/matching/rerank.ts
import type { CandidateScore } from './engine'
import type { ProfileForMatching } from './compatibility'

export interface RerankContext {
  reference: ProfileForMatching
  /** Hard bound: rerank stage may only see K candidates, K ≤ 50. */
  k: number
}

export interface SemanticReranker {
  /** Stable name used in cache keys + experiment artifacts. */
  readonly name: string
  /** Returns candidates re-ordered by rerank quality (must not add/drop). */
  rerank(candidates: CandidateScore[], ctx: RerankContext): CandidateScore[]
}

/** Deterministic fallback: preserves structured order, annotates rerankScore. */
export const identityReranker: SemanticReranker = {
  name: 'identity.v1',
  rerank: (candidates) =>
    candidates.map((c) => ({ ...c, rerankScore: c.score })),
}

/** Overlap-based candidate similarity (proxy for semantic relevance), 0..1. */
function skillSimilarity(a: CandidateScore, b: CandidateScore): number {
  const A = a.skills ?? []
  const B = b.skills ?? []
  if (A.length === 0 || B.length === 0) return 0
  // #101 — O(n+m) Set-based intersection instead of filter/includes O(n*m).
  const bSet = new Set(B)
  let intersection = 0
  for (const s of A) {
    if (bSet.has(s)) intersection++
  }
  const union = new Set([...A, ...B]).size
  // Both arrays are non-empty past the guard above, so `union >= 1` — the
  // former `union === 0 ? 0 :` arm was unreachable (dead branch).
  return intersection / union
}

/**
 * Deterministic Maximal-Marginal-Relevance reranker (audit #27). Rewards
 * structured score while penalising similarity to already-selected
 * candidates, so ranking changes when semantic relevance differs. Uses only
 * in-band features (no pgvector - DB TARGET rule); bounded to the ≤50
 * window; fully deterministic (score, then id tie-breaks).
 */
const LAMBDA = 0.7 // relevance weight vs diversity

export const diversityReranker: SemanticReranker = {
  name: 'mmr.v1',
  rerank(candidates, _ctx) {
    if (candidates.length <= 1) {
      return candidates.map((c) => ({ ...c, rerankScore: c.score }))
    }
    const order: CandidateScore[] = []
    const pool = [...candidates]
    pool.sort(
      (a, b) => b.score - a.score || a.candidateId.localeCompare(b.candidateId),
    )
    order.push(pool[0])
    while (order.length < candidates.length) {
      let bestIdx = -1
      let bestMmr = -Infinity
      for (let i = 1; i < pool.length; i++) {
        let maxSim = 0
        for (const s of order) {
          const sim = skillSimilarity(pool[i], s)
          if (sim > maxSim) maxSim = sim
        }
        const mmr = LAMBDA * pool[i].score - (1 - LAMBDA) * maxSim * 100
        const better =
          mmr > bestMmr ||
          (mmr === bestMmr &&
            (pool[i].score > pool[bestIdx].score ||
              (pool[i].score === pool[bestIdx].score &&
                pool[i].candidateId < pool[bestIdx].candidateId)))
        if (better) {
          bestMmr = mmr
          bestIdx = i
        }
      }
      order.push(pool[bestIdx])
      pool.splice(bestIdx, 1)
    }
    return order.map((c) => ({ ...c, rerankScore: Math.round(c.score) }))
  },
}

/** Resolve the active reranker. Single owner - no duplicate rerank paths. */
export function resolveReranker(): SemanticReranker {
  return diversityReranker
}
