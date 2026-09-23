// src/services/matching/index.ts

export {
  computeScores,
  getTopCandidates,
  loadWeights,
  scoreCandidates,
} from './engine'
export { isEligibleCandidate } from './engine'

export type { CandidateScore, MatchingResult } from './engine'

export { isMatchReason, matchReasonLabel } from './reasons'
export type { MatchReason } from './reasons'

export type {
  ProfileForMatching,
  MatchingWeights,
  ScoreBreakdown,
} from './compatibility'

export {
  jaccardScore,
  skillScore,
  roleScore,
  timezoneScore,
  availabilityScore,
  intentScore,
  activityScore,
  diversityScore,
  computeBreakdown,
} from './compatibility'

// ─── Match Service ──────────────────────────────────────

export {
  performSwipe,
  acceptMatch,
  declineMatch,
  requestIntro,
} from './match.service'

export type { Match } from './match.service'
