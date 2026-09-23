// src/services/matching/reasons.ts
// SESSION 16A — DISCOVER "WHY CONNECT" EVIDENCE MODEL.
//
// A match reason is a STRUCTURED FACT, never free text synthesised from the
// score. The UI renders whatever fact is provided; it never invents one. A
// reason appears in the card only when real relationship/context data produced
// it (shared skills, shared events/ideas/location/intent). This module is the
// single owner of the `MatchReason` union and its human-readable labels.

export type MatchReason =
  | { type: 'shared_skill'; skill: string }
  | { type: 'complementary_skill'; mine: string; theirs: string }
  | { type: 'shared_interest'; value: string }
  | { type: 'shared_idea'; ideaId: string }
  | { type: 'shared_event'; eventId: string }
  | { type: 'shared_location'; city: string }
  | {
      type: 'intent_fit'
      direction: 'both' | 'mine_to_theirs' | 'theirs_to_mine'
    }
  // Real policy fact: the candidate filled an exploration slot (diversity cap).
  | { type: 'exploration' }

export function isMatchReason(value: unknown): value is MatchReason {
  if (typeof value !== 'object' || value === null) return false
  const t = (value as { type?: unknown }).type
  return (
    typeof t === 'string' &&
    [
      'shared_skill',
      'complementary_skill',
      'shared_interest',
      'shared_idea',
      'shared_event',
      'shared_location',
      'intent_fit',
      'exploration',
    ].includes(t)
  )
}

// Single writer of human labels for a structured fact. Deterministic; never
// free-text injected by a caller. Missing context (e.g. an event without a
// title) degrades to a generic, still-true sentence rather than a claim.
export function matchReasonLabel(reason: MatchReason): string {
  switch (reason.type) {
    case 'shared_skill':
      return `You both ${reason.skill ? `know ${reason.skill}` : 'share a skill'}.`
    case 'complementary_skill':
      return `Your ${reason.mine || 'skills'} complement their ${
        reason.theirs || 'skills'
      }.`
    case 'shared_interest':
      return `You share an interest in ${reason.value || 'the same topics'}.`
    case 'shared_idea':
      return "You're both connected to a shared idea."
    case 'shared_event':
      return "You're both connected to a shared event."
    case 'shared_location':
      return `You're both in ${reason.city || 'the same area'}.`
    case 'intent_fit':
      if (reason.direction === 'both') return 'You both want to collaborate.'
      if (reason.direction === 'mine_to_theirs')
        return "You'd like to work with them."
      return "They'd like to work with you."
    case 'exploration':
      return 'Exploring a new role mix for you.'
  }
}
