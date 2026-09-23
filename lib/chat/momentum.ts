// src/lib/chat/momentum.ts
// ─────────────────────────────────────────────────────────────────────────────
// Client-safe single source of truth for conversation-momentum thresholds and
// canonical suggestion sources. The server service (relationships) re-exports
// these so the FE prompt derivation and BE momentum state can never drift.
//
// V10-BE-01 / V10-BE-02 — thresholds mirror `MOMENTUM_THRESHOLDS`.
// ─────────────────────────────────────────────────────────────────────────────

export const MOMENTUM_THRESHOLDS = {
  /** Hours after the viewer's last unanswered message before "awaiting_reply". */
  awaitingReplyHours: 24,
  /** Hours of conversation gap before a "conversation_gap" suggestion is eligible. */
  conversationGapHours: 72,
} as const

/** Canonical relationship suggestion source categories (V10-BE-02). */
export const RELATIONSHIP_SUGGESTION_SOURCES = [
  'shared_interest',
  'shared_skill',
  'complementary_skill',
  'shared_event',
  'shared_idea',
  'same_city',
  'conversation_gap',
] as const

export type RelationshipSuggestionSource =
  (typeof RELATIONSHIP_SUGGESTION_SOURCES)[number]
