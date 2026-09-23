// src/services/profiles/mappers.ts
// Pure, client-safe mappers — no server-only imports.
// Session 01-02 freeze: bio→about, lookingFor→seeking, offering→providing
// are the canonical view-model mappings for ConnectProfileViewModel.

import type { OnboardingStatus } from './onboarding'
import type { Tables } from '@/types/database'
import type { SocialLinks } from '@/types/profile'
import { getIntentLabel, type CollaborationIntent } from './intent'
import {
  COMMITMENT_LABELS,
  WORK_STYLE_LABELS,
  type ConnectProfileViewModel,
  type ProfileEducationItem,
  type ProfileOwnershipModel,
  type ProfileStatus,
  type ProviderProfileStateModel,
} from './model'
import {
  resolveAvatarOrigin,
  type AvatarOrigin,
  type ProfileExperienceItem,
  type ProfileRowLike,
} from './projection'

export interface Profile {
  id: string
  fullName: string
  role: string
  bio?: string | null
  /** User-owned introduction headline (profiles.headline). Provider headline stays on the view model only. */
  headline?: string | null
  socialLinks?: SocialLinks | null
  skills: string[]
  // City-only location slot — never a fabrication. Absent until the city
  // resolution service fills it, per city-only display policy (timezone is
  // scheduling data, not a profile display field).
  city: string | null
  availability: {
    days: string[]
    // Absent = user never set working hours; consumers must not fabricate.
    hours: { start: string; end: string } | null
  }
  timezone: string
  lookingFor: { roles: string[] }
  offering: { categories: string[] }
  visibility: 'public' | 'recruiting' | 'private' | 'stealth'
  avatarUrl?: string | null
  commitmentLevel?: string | null
  workStyle?: string | null
  lastActiveAt: string | null
  createdAt: string
  updatedAt: string
  // S06 — onboarding state resolved with the same profile query (no extra round trip)
  // null = not carried in this view (public candidate rows); never fabricated.
  onboardingStatus: OnboardingStatus | null
  onboardingCompletedAt: string | null
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseSocialLinks(value: unknown): SocialLinks | null {
  if (!isRecord(value)) return null
  const github = asNullableString(value.github)
  const linkedin = asNullableString(value.linkedin)
  const twitter = asNullableString(value.twitter)
  const portfolio = asNullableString(value.portfolio)
  if (!github && !linkedin && !twitter && !portfolio) return null
  return { github, linkedin, twitter, portfolio }
}

export function rowToProfile(row: Partial<Tables<'profiles'>>): Profile {
  // The generated Database types predate the Session 03 `headline`/`idea`/`social_links`
  // columns (migration 20260903…); the canonical projection selects them, so
  // read through a narrow cast — never fabricate the value.
  const introductionRow = row as Partial<Tables<'profiles'>> & {
    headline?: string | null
    social_links?: unknown
  }
  return {
    id: row.id ?? '',
    fullName: row.full_name ?? '',
    role: row.role ?? '',
    bio: row.bio,
    headline: introductionRow.headline ?? null,
    socialLinks: parseSocialLinks(introductionRow.social_links),
    skills: row.skills || [],
    city: row.city ?? null,
    availability: (row.availability as Profile['availability'] | null) ?? {
      days: [],
      hours: null,
    },
    timezone: row.timezone ?? '',
    lookingFor: (row.looking_for as { roles: string[] } | null) ?? {
      roles: [],
    },
    offering: (row.offering as { categories: string[] } | null) ?? {
      categories: [],
    },
    visibility: row.visibility || 'public',
    avatarUrl: row.avatar_url,
    commitmentLevel: row.commitment_level,
    workStyle: row.work_style,
    // #51: keep null when no activity is recorded — updated_at is a profile
    // edit timestamp, not activity; fabricating it misleads "last active" UI.
    lastActiveAt: row.last_active_at ?? null,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
    onboardingStatus:
      row.onboarding_status === 'completed' ? 'completed' : 'pending',
    onboardingCompletedAt: row.onboarding_completed_at ?? null,
  }
}

// S08 (§4.1) — the user-edit db mapper emits USER-OWNED columns only.
// Provider-owned columns (full_name, role, avatar_url, city + future
// provider_headline/location/linked_in_identity) are intentionally unmappable
// here, so no user-write path can ever produce them. The provider write path
// (auth provisioning, S07 LinkedIn sync) builds its own payloads against
// pickProviderWritable() in field-ownership.ts.
export function inputToDbUpdate(input: {
  bio?: string | null
  skills?: string[]
  availability?: {
    days: string[]
    hours: { start: string; end: string }
  }
  timezone?: string
  lookingFor?: { roles: string[] }
  visibility?: 'public' | 'recruiting' | 'private' | 'stealth'
  commitmentLevel?: string | null
  workStyle?: string | null
  offering?: { categories: string[] }
  socialLinks?: SocialLinks | null
}): Record<string, unknown> {
  const update: Record<string, unknown> = {}
  if (input.bio !== undefined) update.bio = input.bio
  if (input.skills !== undefined) update.skills = input.skills
  if (input.availability !== undefined) update.availability = input.availability
  if (input.timezone !== undefined) update.timezone = input.timezone
  if (input.lookingFor !== undefined) update.looking_for = input.lookingFor
  if (input.visibility !== undefined) update.visibility = input.visibility
  if (input.commitmentLevel !== undefined)
    update.commitment_level = input.commitmentLevel
  if (input.workStyle !== undefined) update.work_style = input.workStyle
  if (input.offering !== undefined) update.offering = input.offering
  if (input.socialLinks !== undefined) update.social_links = input.socialLinks
  return update
}

// ─── Session 01-02 — canonical view-model mappers ─────────────────────────
// bio → about, lookingFor → seeking, offering → providing
// Provider-owned headline and avatar are read-only; legacy fields
// (commitment/work-style/skills/availability/timezone/visibility/interests/
// story/provider-location/media/context) are intentionally not mapped.
//
// src7 S02 — the enriched identity block (linkedinUrl/location/workMode),
// statuses, ownership and provider state are all DERIVED from real stored
// values below. Nothing is invented: missing provider data stays null/[] and
// the provider-state booleans default to false when no connection row exists.

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asCollabIntents(value: unknown, key: string): CollaborationIntent[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const arr = (value as Record<string, unknown>)[key]
  if (!Array.isArray(arr)) return []
  return arr.filter((v): v is CollaborationIntent => typeof v === 'string')
}

/**
 * Parse the LinkedIn sync's `provider_linked_in_identity` jsonb
 * ({ provider, provider_user_id }) and resolve the honest profile URL. LinkedIn
 * OIDC yields only the member id, so this is the static URL, never a vanity
 * guess. Missing/empty member id → null (no URL invented from thin air).
 */
export function resolveLinkedInUrl(
  providerLinkedInIdentity: unknown,
): string | null {
  if (!isRecord(providerLinkedInIdentity)) return null
  const providerUserId = asNullableString(
    providerLinkedInIdentity.provider_user_id,
  )
  if (!providerUserId) return null
  return `https://www.linkedin.com/in/${encodeURIComponent(providerUserId)}`
}

/**
 * Tolerantly read a location label out of `provider_location` jsonb. The
 * LinkedIn sync writes `{ country_code, localized_name }`; the projection also
 * tolerates locality/name/label keys. Never fabricates a location.
 */
function parseProviderLocationLabel(value: unknown): string | null {
  if (!isRecord(value)) return null
  return (
    asNullableString(value.localized_name) ??
    asNullableString(value.label) ??
    asNullableString(value.locality) ??
    asNullableString(value.name) ??
    asNullableString(value.city) ??
    null
  )
}

/**
 * City-only display slot: the user `city` wins, else the provider location
 * label. Real stored values only — null when neither exists.
 */
export function resolveLocationValue(
  city: string | null | undefined,
  providerLocation: unknown,
): string | null {
  const cityValue = asNullableString(city)
  if (cityValue) return cityValue
  return parseProviderLocationLabel(providerLocation)
}

/**
 * REAL status pills derived only from stored values: role → commitment →
 * work_style, in that stable order, each deduped. A missing field produces no
 * pill — the rail can never show a fabricated status.
 */
export function buildStatuses(input: {
  role: string | null | undefined
  commitmentLevel: string | null | undefined
  workStyle: string | null | undefined
}): ProfileStatus[] {
  const statuses: ProfileStatus[] = []
  const roleLabel = getIntentLabel(input.role ?? '')
  if (roleLabel != null) statuses.push({ label: roleLabel, origin: 'role' })
  const commitment =
    input.commitmentLevel != null
      ? COMMITMENT_LABELS[input.commitmentLevel]
      : undefined
  if (commitment != null)
    statuses.push({ label: commitment, origin: 'commitment' })
  const workStyle =
    input.workStyle != null ? WORK_STYLE_LABELS[input.workStyle] : undefined
  if (workStyle != null)
    statuses.push({ label: workStyle, origin: 'work_style' })
  return statuses
}

/** Per-section origin — proven from storage, never claimed from absence. */
function buildOwnership(input: {
  avatarOrigin: AvatarOrigin
  headline: string | null
  providerHeadline: string | null
  about: string | null
  building: string | null
}): ProfileOwnershipModel {
  return {
    photo: input.avatarOrigin,
    headline: input.headline
      ? 'user'
      : input.providerHeadline
        ? 'provider_linkedin'
        : 'none',
    about: input.about ? 'user' : 'none',
    building: input.building ? 'user' : 'none',
    collaboration: 'user',
  }
}

/** Default provider state — false unless a real connection row says otherwise. */
const DEFAULT_PROVIDER_STATE: ProviderProfileStateModel = {
  linkedinConnected: false,
  identityAvailable: false,
  historyAvailable: false,
}

/**
 * Map a DB row (or projection-like row) to the canonical ConnectProfileViewModel.
 * Pure + deterministic.
 */
export function rowToViewModel(
  row: ProfileRowLike & {
    headline?: string | null
    idea?: string | null
    provider_headline?: string | null
    city?: string | null
    provider_linked_in_identity?: unknown
    provider_location?: unknown
  },
  opts?: {
    experience?: ProfileExperienceItem[]
    education?: ProfileEducationItem[]
    provider?: ProviderProfileStateModel
  },
): ConnectProfileViewModel {
  const offering = asCollabIntents(row.offering, 'categories')
  const seeking = asCollabIntents(row.looking_for, 'roles')
  const headline = asNullableString(row.headline)
  const providerHeadline = asNullableString(row.provider_headline)
  const avatarOrigin = resolveAvatarOrigin(row.avatar_url)
  return {
    identity: {
      id: asString(row.id),
      name: asString(row.full_name),
      avatarUrl: (row.avatar_url as string | null) ?? null,
      linkedinUrl: resolveLinkedInUrl(row.provider_linked_in_identity),
      location: resolveLocationValue(row.city, row.provider_location),
      workMode:
        row.work_style != null
          ? (WORK_STYLE_LABELS[row.work_style] ?? null)
          : null,
    },
    headline: headline ?? providerHeadline,
    about: asNullableString(row.bio),
    idea: asNullableString(row.idea),
    providing: offering,
    seeking,
    statuses: buildStatuses({
      role: row.role ?? null,
      commitmentLevel: row.commitment_level ?? null,
      workStyle: row.work_style ?? null,
    }),
    ownership: buildOwnership({
      avatarOrigin,
      headline,
      providerHeadline,
      about: asNullableString(row.bio),
      building: asNullableString(row.idea),
    }),
    provider: opts?.provider ?? DEFAULT_PROVIDER_STATE,
    experience: opts?.experience ?? [],
    education: opts?.education ?? [],
  }
}

/** Map the legacy Profile shape to the canonical view model. */
export function profileToViewModel(
  profile: Profile,
  opts?: {
    headline?: string | null
    idea?: string | null
    experience?: ProfileExperienceItem[]
    education?: ProfileEducationItem[]
    provider?: ProviderProfileStateModel
  },
): ConnectProfileViewModel {
  const headline = asNullableString(opts?.headline ?? null)
  const idea = asNullableString(opts?.idea ?? null)
  return {
    identity: {
      id: profile.id,
      name: profile.fullName,
      avatarUrl: profile.avatarUrl ?? null,
      linkedinUrl: null,
      location: profile.city ?? null,
      workMode:
        profile.workStyle != null
          ? (WORK_STYLE_LABELS[profile.workStyle] ?? null)
          : null,
    },
    headline,
    about: profile.bio ?? null,
    idea,
    providing: (profile.offering?.categories as CollaborationIntent[]) ?? [],
    seeking: (profile.lookingFor?.roles as CollaborationIntent[]) ?? [],
    statuses: buildStatuses({
      role: profile.role ?? null,
      commitmentLevel: profile.commitmentLevel ?? null,
      workStyle: profile.workStyle ?? null,
    }),
    ownership: buildOwnership({
      avatarOrigin: resolveAvatarOrigin(profile.avatarUrl ?? null),
      headline,
      providerHeadline: null,
      about: profile.bio ?? null,
      building: idea,
    }),
    provider: opts?.provider ?? DEFAULT_PROVIDER_STATE,
    experience: opts?.experience ?? [],
    education: opts?.education ?? [],
  }
}

/** Alias for external consumers: view-model is the canonical profile view. */
export const toConnectProfileViewModel = rowToViewModel
