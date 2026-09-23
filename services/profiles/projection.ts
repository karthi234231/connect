// src/services/profiles/projection.ts
// V10-BE-05 — Canonical human-first profile projection.
//
// ONE semantic projection shared by Profile, Preview, Discover, Chat context,
// Events and Ideas:
//
//   identity, current_role, city, bio/introduction, looking_for[], offering[],
//   experience[], skills[], shared_context[]
//
// Explicit field ownership metadata (provider vs user-edited) reuses
// field-ownership.ts. The PUBLIC variant is typed so private fields
// (email, phone, security fields, owner-only settings) cannot exist on it;
// the OWNER variant adds owner-only fields.
//
// Fields without a stored source today (city, shared_context) are projected as
// explicit EMPTY state — never fabricated. Their slots are the contract the
// city/LinkedIn and mutual-context services will fill. `experience` stays empty
// by default and is filled by attachExperience()/experience-read (Session 11).

import type { OnboardingStatus } from './onboarding'
import { PROFILE_FIELD_OWNER, type FieldOwner } from './field-ownership'
import {
  getLookingForCategory,
  getOfferingCategory,
  LOOKING_FOR_CATEGORIES,
  OFFERING_CATEGORIES,
  type CollaborationIntent,
  type LookingForIntent,
  type OfferingIntent,
} from './intent'

// ─── Column list (single source for every profile read) ────────────────────
// Public-safe: contains no email/phone/security fields and nothing beyond the
// profiles table. `offering` is the canonical intent column (Mini Session 4).
// Owner-only columns (notification_prefs) are appended separately.
// Session 11: provider identity slots (headline + location) joined into the
// canonical read. Both columns are S07 additions to `profiles` and are typed
// in database.ts; the row-like cast keeps them undefined when a legacy row
// lacks them, and mapRowToProjection treats that as null/empty (see the
// defensive branch in the mapper).
export const PROFILE_PROJECTION_COLUMNS =
  'id, full_name, role, bio, skills, availability, timezone, looking_for, offering, visibility, avatar_url, commitment_level, work_style, last_active_at, created_at, updated_at, onboarding_status, onboarding_completed_at, provider_headline, provider_location, headline, idea'

// ─── Row shape (superset of the table row for defensive mapping) ───────────
// Legitimate defensive reads may carry extra keys (e.g. a future private
// email/phone) that the PUBLIC projection must still never surface.
export interface ProfileRowLike {
  id?: string | null
  full_name?: string | null
  avatar_url?: string | null
  role?: string | null
  bio?: string | null
  skills?: string[] | null
  availability?: unknown
  timezone?: string | null
  looking_for?: unknown
  offering?: unknown
  commitment_level?: string | null
  work_style?: string | null
  visibility?: string | null
  last_active_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  onboarding_status?: string | null
  onboarding_completed_at?: string | null
  app_role?: string | null
  notification_prefs?: unknown
  suspended_at?: string | null
  email?: string | null
  phone?: string | null
  // S07 provider identity columns (typed in database.ts, migration
  // 20260912000000). Row-like casts keep them undefined when a legacy row
  // lacks them; every consumer must treat undefined as null/empty (the
  // mapper already does).
  provider_headline?: string | null
  provider_location?: unknown
  // Session 03 — user-owned introduction columns (migration added both).
  headline?: string | null
  idea?: string | null
}

// ─── Provider-vs-user origin ────────────────────────────────────────────────
// The profiles table has NO provenance column. Provider (LinkedIn OIDC)
// provisioning writes into the same full_name/avatar_url columns and never
// overwrites user-edited data (S05). Rather than invent a fake marker, origin
// is derived from the REAL stored source where one exists — the avatar URL:
//   - /storage/v1/object/public/avatars/...  → user-uploaded (confirmAvatarUpload)
//   - media.licdn.com / static.licdn.com     → LinkedIn provider OIDC picture
//   - otherwise                              → unknown
// This is a display/provenance signal only — never an authorization signal
// (see V12 rule: a public LinkedIn URL is not an API authorization).

export type AvatarOrigin =
  'provider_linkedin' | 'user_upload' | 'unknown' | 'none'

export type FieldOriginSource = 'avatar_url' | 'none'

const LINKEDIN_AVATAR_HOSTS = new Set(['media.licdn.com', 'static.licdn.com'])
const AVATARS_BUCKET_MARKER = '/storage/v1/object/public/avatars/'

export function resolveAvatarOrigin(
  avatarUrl: string | null | undefined,
): AvatarOrigin {
  if (!avatarUrl || avatarUrl.trim().length === 0) return 'none'
  const url = avatarUrl.trim()
  if (url.includes(AVATARS_BUCKET_MARKER)) return 'user_upload'
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (LINKEDIN_AVATAR_HOSTS.has(host)) return 'provider_linkedin'
  } catch {
    // Not a parsable URL — falls through to unknown.
  }
  return 'unknown'
}

// ─── Projection types ───────────────────────────────────────────────────────

export interface ProfileIdentityProjection {
  id: string
  fullName: string
  avatarUrl: string | null
  /** Origin derived from the real stored avatar URL (see above). */
  avatarOrigin: AvatarOrigin
  /** Convenience flag = avatarOrigin === "provider_linkedin". */
  hasProviderOriginAvatar: boolean
}

export interface ProfileAvailabilityProjection {
  days: string[]
  // Absent = user never set hours; consumers must not fabricate.
  hours: { start: string; end: string } | null
}

export interface ProfileExperienceItem {
  id: string
  title: string
  company: string | null
  /** ISO month (YYYY-MM) or null when unknown. */
  startedAt: string | null
  /** ISO month (YYYY-MM); null while current. */
  endedAt: string | null
  isCurrent: boolean
  /** True when sourced from a provider (future LinkedIn sync); false = user-entered. */
  providerOrigin: boolean
  /** Optional role summary — null when unsupported by source data. */
  description?: string | null
  /** Optional company logo — null when unsupported by source data. */
  logoUrl?: string | null
}

/**
 * Canonical mutual-context sources — mirror of the relationship-suggestion
 * source vocabulary (V10-BE-01, `relationship_suggestion_dismissals.source`).
 * V10-BE-07 (mutual-context service) fills this slot; it is empty by default.
 */
export type SharedContextSource =
  | 'shared_interest'
  | 'shared_skill'
  | 'complementary_skill'
  | 'shared_event'
  | 'shared_idea'
  | 'same_city'
  | 'conversation_gap'

export interface ProfileSharedContextItem {
  source: SharedContextSource
  label: string
}

export interface ProfileFieldOwnershipProjection {
  /** Static authority (user / system / provider). */
  owner: FieldOwner
  /**
   * True only when a REAL stored source proves provider origin. Today only the
   * avatar URL is provable; other fields conservatively report false (a
   * missing marker must never be fabricated into a claim).
   */
  hasProviderOrigin: boolean
  originSource: FieldOriginSource
}

/**
 * Provider-sourced location (S07 `profiles.provider_location` jsonb). The view
 * contract is city-only (never the timezone), so only city/country/region and a
 * human label survive the mapper. Null until the first provider sync fills it.
 */
export interface ProfileProviderLocationProjection {
  city: string | null
  country: string | null
  region: string | null
  label: string | null
}

/**
 * Canonical semantic profile. The PUBLIC projection must never contain
 * email/phone/security fields or owner-only settings — this type has no such
 * keys by construction, and the mapper never copies unknown row keys.
 */
export interface ProfileProjection {
  identity: ProfileIdentityProjection
  /** The user's current role (profiles.role). */
  currentRole: string | null
  /**
   * City-only location slot. No location column/table exists yet; city-only
   * display is the product contract, so this stays null until the city
   * resolution service lands. Never fabricated.
   */
  city: string | null
  /**
   * Provider-sourced professional headline (S07 `provider_headline`, e.g. the
   * LinkedIn headline). Optional: null until the first provider sync fills it,
   * then read into the canonical projection. Read-only, provider-owned.
   */
  providerHeadline?: string | null
  /**
   * Provider-sourced location (S07 `provider_location` jsonb), parsed into the
   * city-only view shape. Optional: null until the first provider sync fills
   * it. Read-only, provider-owned.
   */
  providerLocation?: ProfileProviderLocationProjection | null
  /** User-owned introduction headline (profiles.headline). Never provider-derived. */
  headline: string | null
  /** User-owned "What I'm Building" idea (profiles.idea). */
  idea: string | null
  bio: string | null
  lookingFor: {
    roles: LookingForIntent[]
  }
  offering: {
    categories: OfferingIntent[]
  }
  /**
   * Work-experience list. No provider experience sync exists yet (LinkedIn
   * OIDC does not expose a complete history); empty until a real source fills
   * it. All items carry an explicit providerOrigin flag.
   */
  experience: ProfileExperienceItem[]
  skills: string[]
  sharedContext: ProfileSharedContextItem[]
  availability: ProfileAvailabilityProjection
  /**
   * Internal scheduling datum — NOT a profile display field (city-only policy).
   * Exposed here because the DB stores it and discover/matching use it.
   */
  timezone: string | null
  commitmentLevel: string | null
  workStyle: string | null
  visibility: 'public' | 'recruiting' | 'private' | 'stealth'
  lastActiveAt: string | null
  createdAt: string
  updatedAt: string
  /** Per-field ownership + provider-origin metadata. */
  ownership: Record<string, ProfileFieldOwnershipProjection>
  /** Canonical values recovered from storage that are NOT in the taxonomy. */
  unrecognizedIntentValues: string[]
}

/** Owner-only variant: adds the private fields the owner may see. */
export interface OwnerProfileProjection extends ProfileProjection {
  onboardingStatus: OnboardingStatus
  onboardingCompletedAt: string | null
  notificationPrefs: Record<string, boolean> | null
  appRole: 'admin' | 'user'
}

// ─── Pure mappers ───────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null
}

/**
 * Parse the S07 `provider_location` jsonb into the city-only display shape.
 * Tolerant of the exact key set the provider sync writes: reads city/locality
 * (falling back to a name), plus country/region and a human label.
 */
function parseProviderLocation(
  value: unknown,
): ProfileProviderLocationProjection | null {
  if (!isRecord(value)) return null
  const parsed: ProfileProviderLocationProjection = {
    city:
      asNullableString(value.city) ??
      asNullableString(value.locality) ??
      asNullableString(value.name) ??
      null,
    country: asNullableString(value.country),
    region:
      asNullableString(value.region) ??
      asNullableString(value.state) ??
      asNullableString(value.region_code) ??
      null,
    label:
      asNullableString(value.label) ??
      asNullableString(value.display_name) ??
      asNullableString(value.formatted_address) ??
      null,
  }
  // Nothing usable extracted → treat as empty rather than fabricate a location.
  if (
    parsed.city === null &&
    parsed.country === null &&
    parsed.region === null &&
    parsed.label === null
  ) {
    return null
  }
  return parsed
}

function parseAvailability(value: unknown): ProfileAvailabilityProjection {
  if (!isRecord(value)) {
    // #50: never fabricate hours — absent hours stay absent.
    return { days: [], hours: null }
  }
  const hours = isRecord(value.hours) ? value.hours : {}
  const start = typeof hours.start === 'string' ? hours.start : null
  const end = typeof hours.end === 'string' ? hours.end : null
  return {
    days: asStringArray(value.days),
    hours: start !== null && end !== null ? { start, end } : null,
  }
}

function parseRoleCategories(
  value: unknown,
  key: 'roles' | 'categories',
): { categories: CollaborationIntent[]; unrecognized: string[] } {
  const raw = isRecord(value) ? asStringArray(value[key]) : []
  const categories: CollaborationIntent[] = []
  const unrecognized: string[] = []
  for (const item of raw) {
    if (
      getLookingForCategory(item) !== null ||
      getOfferingCategory(item) !== null
    ) {
      categories.push(item as CollaborationIntent)
    } else {
      unrecognized.push(item)
    }
  }
  return { categories, unrecognized }
}

const OWNERSHIP_FIELDS: ReadonlyArray<{
  projectionKey: string
  dbField: string | null
}> = [
  { projectionKey: 'identity.fullName', dbField: 'full_name' },
  { projectionKey: 'identity.avatarUrl', dbField: 'avatar_url' },
  { projectionKey: 'currentRole', dbField: 'role' },
  { projectionKey: 'providerHeadline', dbField: 'provider_headline' },
  { projectionKey: 'providerLocation', dbField: 'provider_location' },
  { projectionKey: 'city', dbField: null },
  { projectionKey: 'headline', dbField: 'headline' },
  { projectionKey: 'idea', dbField: 'idea' },
  { projectionKey: 'bio', dbField: 'bio' },
  { projectionKey: 'lookingFor', dbField: 'looking_for' },
  { projectionKey: 'offering', dbField: 'offering' },
  { projectionKey: 'experience', dbField: null },
  { projectionKey: 'skills', dbField: 'skills' },
  { projectionKey: 'sharedContext', dbField: null },
  { projectionKey: 'timezone', dbField: 'timezone' },
  { projectionKey: 'availability', dbField: 'availability' },
  { projectionKey: 'commitmentLevel', dbField: 'commitment_level' },
  { projectionKey: 'workStyle', dbField: 'work_style' },
  { projectionKey: 'visibility', dbField: 'visibility' },
]

function buildOwnership(
  avatarOrigin: AvatarOrigin,
): Record<string, ProfileFieldOwnershipProjection> {
  const byField: Record<string, ProfileFieldOwnershipProjection> = {}
  for (const { projectionKey, dbField } of OWNERSHIP_FIELDS) {
    const owner: FieldOwner = dbField
      ? (PROFILE_FIELD_OWNER[dbField] ?? 'user')
      : 'user'
    byField[projectionKey] = {
      owner,
      hasProviderOrigin:
        dbField === 'avatar_url' && avatarOrigin === 'provider_linkedin',
      originSource: dbField === 'avatar_url' ? 'avatar_url' : 'none',
    }
  }
  return byField
}

function parseNotificationPrefs(
  value: unknown,
): Record<string, boolean> | null {
  if (!isRecord(value)) return null
  const prefs: Record<string, boolean> = {}
  for (const [key, val] of Object.entries(value)) {
    prefs[key] = Boolean(val)
  }
  return prefs
}

/**
 * Map a DB row to the canonical projection. Pure + deterministic: identical
 * rows produce identical projections (no timestamps, no randomness).
 */
export function mapRowToProjection(row: ProfileRowLike): ProfileProjection {
  const avatarOrigin = resolveAvatarOrigin(row.avatar_url)
  const lookingFor = parseRoleCategories(row.looking_for, 'roles')
  const offering = parseRoleCategories(row.offering, 'categories')
  const skills = asStringArray(row.skills)

  const projection: ProfileProjection = {
    identity: {
      id: asString(row.id),
      fullName: asString(row.full_name),
      avatarUrl: row.avatar_url ?? null,
      avatarOrigin,
      hasProviderOriginAvatar: avatarOrigin === 'provider_linkedin',
    },
    currentRole: row.role ?? null,
    city: null,
    headline: row.headline ?? null,
    idea: row.idea ?? null,
    bio: row.bio ?? null,
    lookingFor: { roles: lookingFor.categories },
    offering: { categories: offering.categories },
    experience: [],
    skills,
    sharedContext: [],
    availability: parseAvailability(row.availability),
    timezone: row.timezone ?? null,
    commitmentLevel: row.commitment_level ?? null,
    workStyle: row.work_style ?? null,
    visibility: (row.visibility as ProfileProjection['visibility']) ?? 'public',
    lastActiveAt: row.last_active_at ?? null,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
    ownership: buildOwnership(avatarOrigin),
    unrecognizedIntentValues: lookingFor.unrecognized,
  }

  // Session 11 — provider identity slot. Only attach when the S07 column is
  // actually present on the row (current rows skip it), so the default shape
  // is unchanged while the column is still provisioning.
  if (row.provider_headline !== undefined) {
    projection.providerHeadline = row.provider_headline ?? null
  }
  if (row.provider_location !== undefined) {
    projection.providerLocation = parseProviderLocation(row.provider_location)
  }

  return projection
}

/**
 * PUBLIC projection: strips everything outside the canonical public model.
 * The return type has no email/phone/security keys, and the mapper only reads
 * typed row keys — a private field that lands on a row can never leak out.
 */
export function mapRowToPublicProjection(
  row: ProfileRowLike,
): ProfileProjection {
  return mapRowToProjection(row)
}

/** OWNER projection: public model plus owner-only fields. */
export function mapRowToOwnerProjection(
  row: ProfileRowLike,
): OwnerProfileProjection {
  return {
    ...mapRowToProjection(row),
    onboardingStatus:
      row.onboarding_status === 'completed' ? 'completed' : 'pending',
    onboardingCompletedAt: row.onboarding_completed_at ?? null,
    notificationPrefs: parseNotificationPrefs(row.notification_prefs),
    appRole: row.app_role === 'admin' ? 'admin' : 'user',
  }
}

/**
 * Session 11 — attach provider/user experience items to a projection. PURE:
 * never mutates the input projection; returns a new object with `experience`
 * filled. The generic keeps the refined (owner-only) projection type intact, so
 * callers that carry `onboardingStatus`/`notificationPrefs` keep them.
 */
export function attachExperience<TProjection extends ProfileProjection>(
  projection: TProjection,
  items: ProfileExperienceItem[],
): TProjection {
  return { ...projection, experience: items ?? [] }
}

export { LOOKING_FOR_CATEGORIES, OFFERING_CATEGORIES }
