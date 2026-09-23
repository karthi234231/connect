// src/services/profiles/model.ts
// Session 01-02 — Canonical profile view contract.
//
// The app must render ONE shape regardless of data source (DB row, projection,
// mock). This view model is the single source of truth for the profile UI:
// identity + headline + about + idea + providing/seeking + experience + education.
//
// src7 S02 — Enriched with the identity block the header contract requires:
//   identity.linkedinUrl / location / workMode
//   statuses[]          — REAL status values derived only from stored data
//   ownership           — per-section field origin (provider vs user)
//   provider            — LinkedIn connection / identity / history availability
// No new value is invented here: linkedinUrl is derived from
// provider_linked_in_identity.provider_user_id; location resolves city → then
// provider_location.label/localized_name; workMode maps the stored work_style
// enum; statuses are derived in mappers.ts from role/commitment/work_style.
//
// All legacy presentation fields (skills/availability/timezone/visibility/
// interests/story/media/context) are intentionally absent — they do not flow
// through this contract.
//
// Field mapping (DB → view):
//   bio          → about
//   looking_for  → seeking
//   offering     → providing
//   full_name    → identity.name
//   avatar_url   → identity.avatarUrl
//   provider_headline → headline
//   idea         → idea
//   profile_experiences → experience
//   profile_education   → education

import type { CollaborationIntent } from './intent'
import type { ProfileExperienceItem, AvatarOrigin } from './projection'

/**
 * Education item — structural twin of ProfileExperienceItem.
 * Mirrors the S07 `profile_education` contract with the same ISO-month date
 * contract and provider-origin flag.
 */
export interface ProfileEducationItem {
  id: string
  school: string
  degree: string | null
  fieldOfStudy: string | null
  startedAt: string | null
  endedAt: string | null
  isCurrent: boolean
  providerOrigin: boolean
  /** Optional summary — null when unsupported by source data. */
  description?: string | null
  /** Optional institution logo — null when unsupported by source data. */
  logoUrl?: string | null
}

// ─── Identity block ──────────────────────────────────────────────────────────

/** Human labels for the stored `commitment_level` enum (never fabricated). */
export const COMMITMENT_LABELS: Record<string, string> = {
  exploring: 'Exploring',
  nights_weekends: 'Nights & Weekends',
  part_time: 'Part-Time',
  full_time: 'Full-Time',
}

/** Human labels for the stored `work_style` enum (never fabricated). */
export const WORK_STYLE_LABELS: Record<string, string> = {
  structured: 'Structured',
  flexible: 'Flexible',
  fast_iterate: 'Fast Iterate',
  deliberate: 'Deliberate',
}

/** Which real stored field produced a status pill — provenance, not copy. */
export type ProfileStatusOrigin = 'role' | 'commitment' | 'work_style'

export interface ProfileStatus {
  label: string
  origin: ProfileStatusOrigin
}

/**
 * Identity meta shown in the Profile header. Every value is derived from REAL
 * stored data in mappers.ts; a missing value stays null (never fabricated).
 */
export interface ProfileIdentityModel {
  id: string
  name: string
  avatarUrl: string | null
  /**
   * Derived from `provider_linked_in_identity.provider_user_id` →
   * https://www.linkedin.com/in/{id}. LinkedIn OIDC only yields the member id,
   * so this is the honest static profile URL. Null when no identity is stored.
   */
  linkedinUrl: string | null
  /**
   * City-only display slot: `city` when set, else the provider location label
   * (provider_location.localized_name / label). Real stored values only.
   */
  location: string | null
  /** Human label of the stored `work_style` enum (the honest "work mode"). */
  workMode: string | null
}

// ─── Section ownership ───────────────────────────────────────────────────────

/**
 * Per-section origin used for honest "Via LinkedIn"/"Edited on Connect" copy.
 * The photo origin is the ONLY field proven from storage today (avatar URL);
 * headline proves provider origin via provider_headline. Nothing is claimed
 * from absence — an empty headline reports "none", never "provider".
 */
export interface ProfileOwnershipModel {
  photo: AvatarOrigin
  headline: 'provider_linkedin' | 'user' | 'none'
  about: 'user' | 'none'
  building: 'user' | 'none'
  collaboration: 'user'
}

// ─── Provider availability ───────────────────────────────────────────────────

export interface ProviderProfileStateModel {
  /** A `profile_provider_connections` row exists for LinkedIn. */
  linkedinConnected: boolean
  /** A LinkedIn identity (id + profile) has been fetched and stored. */
  identityAvailable: boolean
  /** A LinkedIn sync actually ran (sync_state "synced" / last_success_at). */
  historyAvailable: boolean
}

// ─── Canonical view model ────────────────────────────────────────────────────

export interface ConnectProfileViewModel {
  identity: ProfileIdentityModel
  headline: string | null
  about: string | null
  idea: string | null
  providing: CollaborationIntent[]
  seeking: CollaborationIntent[]
  /** E.g. "Full-Time", "Engineer" — REAL, derived only from stored data. */
  statuses: ProfileStatus[]
  /** Per-section origin for provenance copy ("Via LinkedIn" / "Edited on Connect"). */
  ownership: ProfileOwnershipModel
  /** LinkedIn connection / identity / history availability. */
  provider: ProviderProfileStateModel
  experience: ProfileExperienceItem[]
  education: ProfileEducationItem[]
}
