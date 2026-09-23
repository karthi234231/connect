// src/services/ideas/idea-relationship.ts
// ─────────────────────────────────────────────────────────────────────────────
// SESSION 34 — Idea Relationship Loop (pure prompt resolver).
//
// The idea detail surface must be relationship-aware WITHOUT inventing
// connections. This resolver maps the three spec states onto text that uses
// ONLY authoritative inputs:
//
//   - interested but no conversation → starter suggestion
//   - active conversation             → next-step suggestion
//   - inactive (gap past threshold)   → gentle reminder
//
// Data sources (all relationship-aware, all real):
//   - `interested`: the viewer liked/sparked the idea (idea_interests), or is
//     a member/applicant — a genuine connection to this idea.
//   - `conversation`: an EXISTING match-thread with the owner. We never claim
//     one exists; the caller passes authoritative presence + recency.
//   - `sharedContext`: optional MutualContextItem[] from getMutualContext
//     (real stored data only). Only the FIRST item's explanation is ever
//     surfaced, verbatim — never paraphrased, never fabricated.
//
// Truthfulness rules (same as chat RelationshipPrompt):
//   - no interest AND no membership → null (stay quiet, never suggest).
//   - no conversation → starter, only when `interested` is true.
//   - conversation present but stale → gentle reminder (never guilt-inducing).
//   - conversation fresh → next-step (only when sharedContext is non-empty,
//     else null — never fabricate a reason to meet).
// ─────────────────────────────────────────────────────────────────────────────

import type { MutualContextItem } from '@/services/relationships/mutual-context'

export type IdeaRelationshipPromptKind = 'starter' | 'next-step' | 'reminder'

export interface IdeaRelationshipPromptInput {
  /** Viewer liked/sparked, is a member, or has a pending request. */
  interested: boolean
  /**
   * Authoritative conversation presence with the idea owner, if the caller
   * resolved it (e.g. via an active match + thread). Null/undefined = none
   * known — never assumed.
   */
  conversation?: {
    /** True when messages exist in the thread. */
    hasMessages: boolean
    /** True when the gap since the last message passed the nudge threshold. */
    isStale: boolean
  } | null
  /** Real shared-context items (getMutualContext); first item used verbatim. */
  sharedContext?: MutualContextItem[]
  /** Owner display name for copy; defaults to a neutral noun. */
  ownerLabel?: string
}

export interface IdeaRelationshipPrompt {
  kind: IdeaRelationshipPromptKind
  headline: string
  body: string
}

/**
 * Resolve the single relationship prompt for the idea detail surface, or
 * null when there is nothing authoritative to suggest.
 */
export function resolveIdeaRelationshipPrompt(
  input: IdeaRelationshipPromptInput,
): IdeaRelationshipPrompt | null {
  const owner = (input.ownerLabel ?? '').trim() || 'the founder'
  const sharedLine = (input.sharedContext ?? [])[0]?.explanation ?? null

  const conversation = input.conversation ?? null
  const hasConversation = Boolean(conversation?.hasMessages)

  // Active conversation → next-step, but ONLY with a real shared fact.
  if (hasConversation && !conversation?.isStale) {
    if (!sharedLine) return null
    return {
      kind: 'next-step',
      headline: 'Keep the momentum going',
      body: `${sharedLine} Suggest a quick call or coffee with ${owner} to talk next steps.`,
    }
  }

  // Stale conversation → gentle reminder (applies to interested viewers AND
  // members; both have a genuine thread worth reviving).
  if (hasConversation && conversation?.isStale) {
    return {
      kind: 'reminder',
      headline: 'Pick it back up',
      body: `It's been a while since you talked with ${owner} — send a friendly follow-up.`,
    }
  }

  // Interested but no conversation → starter suggestion.
  if (input.interested) {
    return {
      kind: 'starter',
      headline: 'Interested in this idea?',
      body: sharedLine
        ? `${sharedLine} Say hi to ${owner} and share what caught your eye.`
        : `Say hi to ${owner} and share what caught your eye about this idea.`,
    }
  }

  return null
}
