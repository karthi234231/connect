// src/services/matching/ranking-policy.ts
// S038 — Deterministic diversity re-rank + exploration injection.
// Every stage is explainable (reason codes), bounded to the final candidate
// set, and fully deterministic (stable sort + id tie-breaks).
import type { CandidateScore } from './engine'
import type { ProfileForMatching } from './compatibility'

export interface RankedCandidate extends CandidateScore {
  rerankScore?: number
  /** "structure" = plain ranked, "diversity" = held back by role cap, "explore" = exploration slot. */
  rankOrigin: 'structure' | 'diversity' | 'explore'
}

/** Per-role cap inside the final window. Deterministic product rule. */
export const ROLE_CAP_RATIO = 0.6

export interface DiversityOptions {
  limit: number
  /** role lookup for candidates (id → role). */
  roleOf: (candidateId: string) => string
}

/**
 * Greedy re-rank enforcing a per-role cap on the selected window.
 * Never mutates order beyond what the cap requires; ties stay id-sorted.
 */
export function applyDiversityCap(
  ranked: CandidateScore[],
  opts: DiversityOptions,
): RankedCandidate[] {
  const cap = Math.max(1, Math.ceil(opts.limit * ROLE_CAP_RATIO))
  const perRole = new Map<string, number>()
  const picked: RankedCandidate[] = []
  const deferred: CandidateScore[] = []

  const underCap = (role: string) => (perRole.get(role) ?? 0) < cap

  const take = (
    candidate: CandidateScore,
    origin: RankedCandidate['rankOrigin'],
  ) => {
    const role = opts.roleOf(candidate.candidateId) || 'other'
    if (!underCap(role)) return false
    perRole.set(role, (perRole.get(role) ?? 0) + 1)
    picked.push({ ...candidate, rankOrigin: origin })
    return true
  }

  for (const candidate of ranked) {
    if (picked.length < opts.limit) {
      const taken = take(candidate, 'structure')
      if (!taken) deferred.push(candidate)
    } else {
      deferred.push(candidate)
    }
  }

  // Backfill from deferred — the cap is a FINAL invariant (#33): an insertion
  // is skipped if its role is already at cap, even if that leaves the window
  // short. Policy compliance outranks window completeness.
  for (const candidate of deferred) {
    if (picked.length >= opts.limit) break
    take(candidate, 'diversity')
  }

  return picked
}

export interface ExplorationOptions {
  /** role lookup for candidates (id → role). */
  roleOf: (candidateId: string) => string
}

/**
 * Exploration: reserve ~10% of the window (min 1, max 2) for the
 * highest-structured-score candidate whose role is absent from the current
 * selection — deterministic, explainable, with explicit fallback.
 */
export function applyExploration(
  selected: RankedCandidate[],
  pool: CandidateScore[],
  reference: ProfileForMatching,
  roleOf: (candidateId: string) => string,
): RankedCandidate[] {
  const quota = Math.min(2, Math.max(1, Math.floor(selected.length * 0.1)))
  // `quota` is >= 1 by construction (Math.max(1, …)), so the former
  // `quota === 0 ||` guard was unreachable (dead branch). Only an empty pool
  // can short-circuit here.
  if (pool.length === 0) return selected

  const selectedRoles = new Set(selected.map((c) => roleOf(c.candidateId)))
  const selectedIds = new Set(selected.map((c) => c.candidateId))

  // Deterministic exploration pool: unselected, structurally scored,
  // role underrepresented; highest score first, id tie-break.
  const explorationPool = pool
    .filter((c) => !selectedIds.has(c.candidateId))
    .filter((c) => !selectedRoles.has(roleOf(c.candidateId)))
    .filter((c) => c.candidateId !== reference.id)
    .sort(
      (a, b) => b.score - a.score || a.candidateId.localeCompare(b.candidateId),
    )

  if (explorationPool.length === 0) return selected

  const result = [...selected]
  for (const candidate of explorationPool.slice(0, quota)) {
    // Replace the weakest non-exploration tail slot; never drop below window.
    if (result.length < 1) break
    result.pop()
    result.push({
      ...candidate,
      rankOrigin: 'explore',
      reasons: [...candidate.reasons, { type: 'exploration' as const }],
    })
  }

  return result
}
