// src/services/relationships/index.ts
// V10-BE-01 / V10-BE-02 — authoritative relationship momentum + suggestions.
export {
  deriveRelationshipState,
  getRelationshipState,
  dismissSuggestion,
} from './relationship-state'
export {
  MOMENTUM_THRESHOLDS,
  RELATIONSHIP_SUGGESTION_SOURCES,
} from '@/lib/chat/momentum'
export type {
  RelationshipMomentumState,
  RelationshipSuggestion,
  RelationshipState,
  RelationshipStateInput,
} from './relationship-state'
export type { RelationshipSuggestionSource } from '@/lib/chat/momentum'
// P0-11 — §77 action queue + §140.2/§360.2 relationship state contract.
export {
  CANONICAL_RELATIONSHIP_STATES,
  FIT_BAND_LABELS,
  FIT_BAND_THRESHOLDS,
  MATCH_QUEUE_SECTIONS,
  RELATIONSHIP_STATE_CONTRACT,
  buildMatchQueue,
  fitBand,
  fitBandLabel,
} from './queue'
export type {
  CanonicalRelationshipState,
  FitBand,
  MatchQueue,
  MatchQueueSectionId,
  NextStep,
  QueueMatch,
  RelationshipStateContractEntry,
  RelationshipStateRealisation,
} from './queue'
// P0-11 — §140.4 relationship history (participant-only read model).
export {
  RELATIONSHIP_HISTORY_EVENTS,
  getRelationshipHistory,
  isRelationshipHistoryEvent,
  parseRelationshipHistory,
  relationshipHistoryLabel,
} from './history'
export type {
  RelationshipHistoryEntry,
  RelationshipHistoryEvent,
} from './history'
