// src/lib/chat/relationship.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure, client-safe helpers that derive the FE relationship-prompt surface from
// authoritative profile data and actual message timestamps. No server I/O.
//
// Truthfulness rules (V10-FE-01 negative requirements):
//  - reasons and starter suggestions come ONLY from real shared profile facts
//    (same role, overlapping skills) — never fabricated interests or events.
//  - reminders never guilt-induce and never auto-send a message.

import { MOMENTUM_THRESHOLDS } from '@/lib/chat/momentum'
import type { RelationshipSuggestionSource } from '@/lib/chat/momentum'
import type { Profile } from '@/services/profiles/mappers'

/**
 * Authoritative shared facts between two participants. Every field is derived
 * from real profile data; an absent field means "no shared fact" — never filler.
 */
export interface SharedContext {
  /** Shared role in infinitive form ("founder" → "founding"), or null when absent. */
  sharedRole: string | null
  /** Case-insensitive intersection of the two profiles' skills (other's casing). */
  sharedSkills: string[]
  /** Both profiles list the same timezone (case-insensitive, non-empty). */
  sameTimezone: boolean
}

const ROLE_LABEL_MAP: Record<string, string> = {
  founder: 'Founder',
  engineer: 'Engineer',
  designer: 'Designer',
  product: 'Product',
  growth: 'Growth',
  operations: 'Operations',
  data_ml: 'Data & ML',
  other: 'Other',
}

const ROLE_NOUN: Record<string, string> = {
  founder: 'founding',
  engineer: 'engineering',
  designer: 'design',
  product: 'product',
  growth: 'growth',
  operations: 'operations',
  data_ml: 'data & ML',
  other: 'their field',
}

/** Title-case a role enum: "data_ml" → "Data & ML". Unknown roles keep as is. */
export function formatRole(role: string): string {
  const key = (role ?? '').trim()

  if (!key) {
    return ''
  }

  return ROLE_LABEL_MAP[key.toLowerCase()] ?? key.replace(/[_-]+/g, ' ')
}

/**
 * Build shared context between the viewer and the other participant using ONLY
 * authoritative profile fields. Never fabricates reasons that do not exist.
 */
export function buildSharedContext(
  viewer: Pick<Profile, 'role' | 'skills' | 'timezone'>,
  other: Pick<Profile, 'role' | 'skills' | 'timezone'>,
): SharedContext {
  const viewerRole = (viewer.role ?? '').trim().toLowerCase()
  const otherRole = (other.role ?? '').trim().toLowerCase()

  const viewerSkillSet = new Set(
    (viewer.skills ?? [])
      .map((skill) => skill.trim().toLowerCase())
      .filter(Boolean),
  )

  // Case-insensitive intersection that preserves the other participant's
  // casing and keeps the first occurrence: "Python" and "python" collapse to
  // a single shared skill so prompts never pose a duplicate fact twice.
  const seen = new Set<string>()
  const sharedSkills: string[] = []
  for (const skill of other.skills ?? []) {
    const candidate = skill.trim()
    if (!candidate) continue
    const fold = candidate.toLowerCase()
    if (!viewerSkillSet.has(fold) || seen.has(fold)) continue
    seen.add(fold)
    sharedSkills.push(candidate)
  }

  const viewerTz = (viewer.timezone ?? '').trim().toLowerCase()
  const otherTz = (other.timezone ?? '').trim().toLowerCase()

  return {
    sharedRole:
      viewerRole !== '' && viewerRole === otherRole
        ? (ROLE_NOUN[viewerRole] ?? formatRole(viewerRole))
        : null,
    sharedSkills,
    sameTimezone: Boolean(viewerTz.length > 0 && viewerTz === otherTz),
  }
}

/** One-line, truthful "why you may get along" line; null when no shared fact exists. */
export function shareReasonLine(context: SharedContext): string | null {
  if (context.sharedRole) {
    return `You both work in ${context.sharedRole}.`
  }

  if (context.sharedSkills.length > 0) {
    return `You both know ${context.sharedSkills[0]}.`
  }

  if (context.sameTimezone) {
    return "You're both in the same timezone."
  }

  return null
}

/** Stable identifiers a dismissal/suppression UI can key on. */
export type StarterPromptKey =
  | 'shared-role'
  | 'shared-skill'
  | 'other-skill'
  | 'role'
  | 'hello'

export interface StarterPrompt {
  /** Stable id for local dismissal/suppression. */
  key: StarterPromptKey
  /** Source category (matches server dismissal semantics where applicable). */
  source: RelationshipSuggestionSource

  /** Relationship-specific starter text (never random/generic). */
  text: string
}

/** Upper bound on starters surfaced at once (deterministic slice). */
export const MAX_STARTERS = 3

/**
 * Relationship-specific first-message suggestions, built deterministically from
 * shared profile facts. Priority mirrors `shareReasonLine` (shared role →
 * shared skill → other's role), so the top prompt always agrees with the reason
 * line. Always at least one truthful option grounded in the relationship
 * (shared role/skill, other's role, or a name-based greeting).
 */
export function buildStarterPrompts(
  context: SharedContext,
  other: Pick<Profile, 'fullName' | 'role' | 'skills'>,
): StarterPrompt[] {
  const firstName = other.fullName?.split(/\s+/).filter(Boolean)[0] ?? 'there'
  const otherRole = formatRole(other.role ?? '')
  const firstSkill = context.sharedSkills[0]?.trim() ?? ''
  const secondSkill = context.sharedSkills[1]?.trim() ?? ''

  const prompts: StarterPrompt[] = []

  if (context.sharedRole) {
    prompts.push({
      key: 'shared-role',
      source: 'shared_interest',
      text: `Since we're both in ${context.sharedRole}, what project are you most excited about right now?`,
    })
  }

  if (context.sharedSkills.length > 0) {
    prompts.push({
      key: 'shared-skill',
      source: 'shared_skill',
      text: `We both have ${firstSkill} — how did you get into that?`,
    })
  }

  if (context.sharedSkills.length > 1) {
    prompts.push({
      key: 'other-skill',
      source: 'shared_skill',
      text: `We also both know ${secondSkill} — have you used it recently?`,
    })
  }

  // Only when no shared role exists does the other's own role get its own
  // prompt; otherwise it would duplicate the shared-role starter.
  if (!context.sharedRole && otherRole) {
    prompts.push({
      key: 'role',
      source: 'shared_interest',
      text: `I'm curious how you got started in ${otherRole}.`,
    })
  }

  // Guarantee one non-empty option, tied to the relationship via their name.
  if (prompts.length === 0) {
    prompts.push({
      key: 'hello',
      source: 'conversation_gap',
      text: `Hey ${firstName}, great to match with you!`,
    })
  }

  return prompts.slice(0, MAX_STARTERS)
}

export interface GentleReminder {
  source: RelationshipSuggestionSource
  headline: string
  nudge: string
}

function hoursBetween(earlierIso: string, laterIso: string): number {
  return (Date.parse(laterIso) - Date.parse(earlierIso)) / 3_600_000
}

/**
 * No-reply reminder, shown ONLY after the awaiting threshold has elapsed since
 * the viewer's last message. Uses gentle, non-guilt-inducing language.
 */
export function buildReminder(
  lastMessageAt: string,
  now: string,
): GentleReminder | null {
  const hours = hoursBetween(lastMessageAt, now)

  if (
    !Number.isFinite(hours) ||
    hours < MOMENTUM_THRESHOLDS.awaitingReplyHours
  ) {
    return null
  }

  const days = Math.max(1, Math.floor(hours / 24))
  const ago = days === 1 ? 'yesterday' : `${days} days ago`
  const headline =
    hours >= MOMENTUM_THRESHOLDS.conversationGapHours
      ? `It's been a while since you reached out (${ago}).`
      : `You reached out ${ago}.`

  return {
    source: 'conversation_gap',
    headline,
    nudge: 'Want to pick it back up?',
  }
}

/** True when there is an authoritative fact we can anchor a next-action suggestion on. */
export function hasActionableContext(context: SharedContext): boolean {
  return Boolean(
    context.sharedRole ||
    context.sharedSkills.length > 0 ||
    context.sameTimezone,
  )
}
