// src/services/linkedin/persistence.ts
// S07 — the ProviderSyncPersistence seam implemented against the real schema.
//
// Lifecycle of one successful sync (the `persist` entry point):
//   1. resolve the authenticated user id (the owner RLS binding for every write)
//   2. upsert provider-owned profiles columns (NEVER user-owned fields)
//   3. reconcile profile_experiences by (user_id, provider_external_id)
//   4. write profile_provider_connections sync metadata ('synced')
//
// Fail-whole semantics without an app-side transaction: every step is
// idempotent and converges on retry (upserts are keyed, reconcile only ever
// deletes rows the synced set provably no longer contains), and the metadata
// write is always LAST — a mid-way failure throws before 'synced' is recorded,
// so a caller retrying converges to the full write without half-truth state.
// A `null` experience/education payload (capability unsupported / data absent)
// NEVER triggers the reconcile-delete path: stored rows are preserved.
//
// Education IS persisted (Session 08): profile_education exists in the real
// schema (migration 20260913100000), so reconcileEducations mirrors the
// experience seam against that table. Provider rows carry only year-level
// dates, and the provider payload has no "current" marker, so is_current stays
// false — we never assume a state the provider did not supply.
import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import type { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'
import type {
  LinkedInProfileWrite,
  LinkedInSyncWrite,
  ProviderSyncPersistence,
} from './sync'
import type {
  LinkedInEducation,
  LinkedInExperience,
  LinkedInLocation,
} from './types'

export const LINKEDIN_SYNC_PROVIDER = 'linkedin' as const

export type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>

export interface LinkedInSyncResultInput {
  userId: string
  /** LinkedIn member id — null when the identity is not yet resolvable. */
  providerUserId: string | null
  state: 'synced' | 'provider_revoked' | 'retryable_error'
  attemptedAt: string
  /** Only meaningful for `synced`; omitted for failure states so the last
   *  successful sync timestamp is never clobbered. */
  successAt?: string | null
  /** Failure reason; written for failures and cleared to null on success. */
  failureReason?: string | null
}

function persistenceError(
  operation: string,
  table: string,
  error: unknown,
): AppError {
  return new AppError(
    ErrorCodes.INTERNAL,
    `LinkedIn provider sync failed to ${operation} ${table}`,
    { cause: error },
  )
}

async function resolveAuthenticatedUserId(
  client: ServerSupabaseClient,
  providerUserId: string,
): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || data.user == null) {
    throw new AppError(
      ErrorCodes.UNAUTHENTICATED,
      'LinkedIn provider sync requires an authenticated user',
      { context: { providerUserId } },
    )
  }
  return data.user.id
}

function toLocationJson(location: LinkedInLocation): Json | null {
  if (!location) return null
  return {
    country_code: location.countryCode,
    localized_name: location.localizedName,
  }
}

/** Provider-owned columns ONLY — user-owned fields are never touched here. */
async function upsertProviderOwnedProfile(
  client: ServerSupabaseClient,
  userId: string,
  providerUserId: string,
  profile: LinkedInProfileWrite,
): Promise<void> {
  const { error } = await client
    .from('profiles')
    .update({
      full_name: profile.fullName,
      avatar_url: profile.avatarUrl,
      provider_headline: profile.providerHeadline,
      provider_location: toLocationJson(profile.providerLocation),
      provider_linked_in_identity: {
        provider: LINKEDIN_SYNC_PROVIDER,
        provider_user_id: providerUserId,
      },
    })
    .eq('id', userId)
  if (error) {
    logger.error(
      '[linkedin-persistence] failed to write provider-owned profile columns',
      { userId },
      error,
    )
    throw persistenceError('update', 'profiles', error)
  }
}

function toIsoDate(
  date: { year: number | null; month: number | null } | null,
): string | null {
  if (!date || date.year == null) return null
  const year = String(date.year).padStart(4, '0')
  const month = date.month == null ? 1 : date.month
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** Education payload carries year-level dates only → YYYY-01-01. */
function toIsoDateYear(date: { year: number | null } | null): string | null {
  if (!date || date.year == null) return null
  return `${String(date.year).padStart(4, '0')}-01-01`
}

/** Keep first occurrence, dedupe by provider_external_id (stable order). */
function dedupeExperience(experience: LinkedInExperience): LinkedInExperience {
  const seen = new Set<string>()
  const out: LinkedInExperience = []
  for (const item of experience) {
    if (item.providerId != null) {
      if (seen.has(item.providerId)) continue
      seen.add(item.providerId)
    }
    out.push(item)
  }
  return out
}

/**
 * Reconcile experiences to the synced set. Existing rows are upserted in place
 * (keyed by user_id + provider_external_id); rows the synced set no longer
 * contains are deleted — but ONLY rows carrying a non-null provider_external_id.
 * Rows without a provider key are never deleted by the provider path, and a
 * `null` payload never enters this function at all.
 * @param experience the synced set (or null to skip — no delete/upsert).
 */
async function reconcileExperiences(
  client: ServerSupabaseClient,
  userId: string,
  experience: LinkedInExperience | null,
): Promise<void> {
  if (experience === null) return

  const rows = dedupeExperience(experience).map((item, index) => ({
    user_id: userId,
    source: LINKEDIN_SYNC_PROVIDER,
    provider_external_id: item.providerId,
    company: item.companyName,
    title: item.title,
    started_at: toIsoDate(item.start),
    ended_at: toIsoDate(item.end),
    is_current: item.current,
    sort_order: index,
  }))

  const { error: upsertError } = await client
    .from('profile_experiences')
    .upsert(rows, { onConflict: 'user_id,provider_external_id' })
  if (upsertError) {
    logger.error(
      '[linkedin-persistence] failed to upsert experiences',
      { userId },
      upsertError,
    )
    throw persistenceError('upsert', 'profile_experiences', upsertError)
  }

  const syncedExternalIds = new Set(
    rows
      .map((row) => row.provider_external_id)
      .filter((id): id is string => typeof id === 'string'),
  )

  const { data: existing, error: readError } = await client
    .from('profile_experiences')
    .select('id, provider_external_id')
    .eq('user_id', userId)
  if (readError) {
    logger.error(
      '[linkedin-persistence] failed to read existing experiences',
      { userId },
      readError,
    )
    throw persistenceError('read', 'profile_experiences', readError)
  }

  const staleIds = (existing ?? [])
    .filter(
      (row) =>
        row.provider_external_id != null &&
        !syncedExternalIds.has(row.provider_external_id),
    )
    .map((row) => row.id)

  if (staleIds.length > 0) {
    const { error: deleteError } = await client
      .from('profile_experiences')
      .delete()
      .in('id', staleIds)
    if (deleteError) {
      logger.error(
        '[linkedin-persistence] failed to remove stale experiences',
        { userId, stale: staleIds.length },
        deleteError,
      )
      throw persistenceError('delete', 'profile_experiences', deleteError)
    }
  }
}

/**
 * Keep first occurrence, dedupe by provider_external_id (stable order).
 * Mirrors dedupeExperience for the education list.
 */
function dedupeEducation(education: LinkedInEducation): LinkedInEducation {
  const seen = new Set<string>()
  const out: LinkedInEducation = []
  for (const item of education) {
    if (item.providerId != null) {
      if (seen.has(item.providerId)) continue
      seen.add(item.providerId)
    }
    out.push(item)
  }
  return out
}

/**
 * Reconcile education rows to the synced set against profile_education (the
 * real table — migration 20260913100000). Same semantics as the experience
 * seam: upsert keyed by (user_id, provider_external_id), delete only rows the
 * synced set no longer contains AND that carry a non-null provider key, and a
 * `null` payload never enters here at all.
 * @param education the synced set (or null to skip — no delete/upsert).
 */
async function reconcileEducations(
  client: ServerSupabaseClient,
  userId: string,
  education: LinkedInEducation | null,
): Promise<void> {
  if (education === null) return

  // `profile_education` is typed in Database (mirrors migration
  // 20260913100000) — use the typed client directly.
  const rows = dedupeEducation(education).map((item, index) => ({
    user_id: userId,
    source: LINKEDIN_SYNC_PROVIDER,
    provider_external_id: item.providerId,
    school: item.schoolName,
    degree: item.degreeName,
    field_of_study: item.fieldOfStudy,
    started_at: toIsoDateYear(item.start),
    ended_at: toIsoDateYear(item.end),
    is_current: false,
    sort_order: index,
  }))

  const { error: upsertError } = await client
    .from('profile_education')
    .upsert(rows, { onConflict: 'user_id,provider_external_id' })
  if (upsertError) {
    logger.error(
      '[linkedin-persistence] failed to upsert education',
      { userId },
      upsertError,
    )
    throw persistenceError('upsert', 'profile_education', upsertError)
  }

  const syncedExternalIds = new Set(
    rows
      .map((row) => row.provider_external_id)
      .filter((id): id is string => typeof id === 'string'),
  )

  const { data: existing, error: readError } = await client
    .from('profile_education')
    .select('id, provider_external_id')
    .eq('user_id', userId)
  if (readError) {
    logger.error(
      '[linkedin-persistence] failed to read existing education',
      { userId },
      readError,
    )
    throw persistenceError('read', 'profile_education', readError)
  }

  const staleIds = (existing ?? [])
    .filter(
      (row) =>
        row.provider_external_id != null &&
        !syncedExternalIds.has(row.provider_external_id),
    )
    .map((row) => row.id)

  if (staleIds.length > 0) {
    const { error: deleteError } = await client
      .from('profile_education')
      .delete()
      .in('id', staleIds)
    if (deleteError) {
      logger.error(
        '[linkedin-persistence] failed to remove stale education',
        { userId, stale: staleIds.length },
        deleteError,
      )
      throw persistenceError('delete', 'profile_education', deleteError)
    }
  }
}

/**
 * Record the terminal sync result on the user's connection row. Shared by the
 * success path (persist → 'synced') and classified-failure writers
 * ('provider_revoked' / 'retryable_error' per classifySyncResult).
 * scopes is intentionally NOT written so a sync can never clobber the granted
 * scope set provisioned by the auth path.
 */
export async function recordLinkedInSyncResult(
  client: ServerSupabaseClient,
  input: LinkedInSyncResultInput,
): Promise<void> {
  const row: {
    user_id: string
    provider: string
    provider_user_id: string | null
    sync_state: string
    last_attempt_at: string
    failure_reason: string | null
    updated_at: string
    last_success_at?: string
  } = {
    user_id: input.userId,
    provider: LINKEDIN_SYNC_PROVIDER,
    provider_user_id: input.providerUserId,
    sync_state: input.state,
    last_attempt_at: input.attemptedAt,
    failure_reason: input.failureReason ?? null,
    updated_at: input.attemptedAt,
  }
  if (input.state === 'synced' && input.successAt != null) {
    row.last_success_at = input.successAt
  }

  const { error } = await client
    .from('profile_provider_connections')
    .upsert(row, { onConflict: 'user_id' })
  if (error) {
    logger.error(
      '[linkedin-persistence] failed to record provider sync metadata',
      { userId: input.userId, state: input.state },
      error,
    )
    throw persistenceError('upsert', 'profile_provider_connections', error)
  }
}

async function persistWrite(
  client: ServerSupabaseClient,
  payload: {
    providerUserId: string
    write: LinkedInSyncWrite
    syncedAt: string
  },
): Promise<void> {
  try {
    const userId = await resolveAuthenticatedUserId(
      client,
      payload.providerUserId,
    )
    await upsertProviderOwnedProfile(
      client,
      userId,
      payload.providerUserId,
      payload.write.profile,
    )
    await reconcileExperiences(client, userId, payload.write.experience)
    await reconcileEducations(client, userId, payload.write.education)
    await recordLinkedInSyncResult(client, {
      userId,
      providerUserId: payload.providerUserId,
      state: 'synced',
      attemptedAt: payload.syncedAt,
      successAt: payload.syncedAt,
      failureReason: null,
    })
  } catch (error) {
    logger.error(
      '[linkedin-persistence] provider sync persist failed',
      { providerUserId: payload.providerUserId },
      error,
    )
    throw AppError.fromUnknown(error, ErrorCodes.INTERNAL, {
      context: { providerUserId: payload.providerUserId },
    })
  }
}

/**
 * Build the S07 persistence seam. Pass a `createServerSupabaseClient()` result
 * (runs as the authenticated user, so the owner RLS policies apply) or a
 * test-stubbable client.
 */
export function createLinkedInPersistence(
  client: ServerSupabaseClient,
): ProviderSyncPersistence {
  return {
    async persist(payload) {
      await persistWrite(client, payload)
    },
  }
}
