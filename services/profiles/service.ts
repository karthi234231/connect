// src/services/profiles/service.ts

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { invalidateUserCache } from '@/lib/cache'
import { runTask } from '@/lib/tasks'
import {
  syncProfileDocuments,
  deleteProfileDocuments,
} from '@/lib/meilisearch/sync'
import { enqueueSlackAlert } from '@/services/alerts/slack-outbox'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'
import {
  profileUpdateSchema,
  introductionSchema,
  collaborationSchema,
  type ProfileUpdateInput,
  type IntroductionInput,
  type CollaborationInput,
} from './profile.schema'
import { computeCompleteness, type ProfileCompleteness } from './completeness'
import { env } from '@/lib/env'
import { randomUUID } from 'crypto'
import type { Database, Tables } from '@/types/database'
import {
  rowToProfile,
  inputToDbUpdate,
  rowToViewModel,
  type Profile,
} from './mappers'
import type {
  ConnectProfileViewModel,
  ProviderProfileStateModel,
} from './model'
import type { ProfileRow } from '@/lib/dto'
import { pickUserEditable } from './field-ownership'
import { fetchProfileExperiences } from './experience-read'
import { fetchProfileEducations } from './education-read'
import { transitionOnboarding, type OnboardingStatus } from './onboarding'
import {
  PROFILE_PROJECTION_COLUMNS,
  mapRowToPublicProjection,
  mapRowToOwnerProjection,
  type ProfileProjection,
  type OwnerProfileProjection,
  type ProfileRowLike,
} from './projection'

export { rowToProfile, inputToDbUpdate, type Profile } from './mappers'

type ExportRequestInsert =
  Database['public']['Tables']['export_requests']['Insert']

type ExportRequestRow = Database['public']['Tables']['export_requests']['Row']

// #89 + V10-BE-05 — ONE canonical public-safe column list for every profile
// read. Profile, Preview, owner and public readers all select the same set, so
// two hand-built queries can never drift. `offering` is the canonical intent
// column (Mini Session 4). Owner-only columns append notification_prefs.
const PROJECTION_OWNER = `${PROFILE_PROJECTION_COLUMNS}, notification_prefs`

// The generated Database types now include `offering` (migration
// 20260907120000) plus `city`, `headline`, `idea` and the S07 provider
// columns. Reads select the canonical column list and narrow to
// `Partial<Tables<'profiles'>>` at the mapper boundary — no `unknown`
// indirection is needed anywhere.

// ─── Profile CRUD ─────────────────────────────────────────

export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return []
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_PROJECTION_COLUMNS)
    .in('id', ids)
  if (error) {
    logger.error('Failed to batch fetch profiles', {
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to fetch profiles', {
      cause: error,
    })
  }
  return (data ?? []).map((row) =>
    rowToProfile(row as Partial<Tables<'profiles'>>),
  )
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('profiles')
    .select(PROJECTION_OWNER)
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }

    logger.error('Failed to fetch profile', {
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to fetch profile', {
      cause: error,
    })
  }

  return rowToProfile(data as Partial<Tables<'profiles'>>)
}

// ─── Profile completeness ────────────────────────────────

// #91 — the ONE authoritative profile-state reader. Completeness, browse
// readiness and action readiness are all derived from this single fetch, so
// the three public helpers can never disagree about what the profile looks like.
const PROFILE_STATE_COLUMNS =
  'full_name, role, bio, skills, availability, timezone, looking_for, avatar_url, commitment_level, work_style, visibility'

interface ProfileState {
  completeness: ProfileCompleteness
  browseReady: boolean
  actionReady: boolean
}

async function loadProfileState(userId: string): Promise<ProfileState | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_STATE_COLUMNS)
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }

    logger.error('Failed to load profile state', {
      userId,
      error: error.message,
    })

    throw new AppError(
      ErrorCodes.INTERNAL,
      'Failed to fetch profile completeness',
      {
        cause: error,
      },
    )
  }

  const completeness = computeCompleteness(data)

  return {
    completeness,
    browseReady: completeness.isBrowseReady,
    actionReady: completeness.isActionReady,
  }
}

export async function getProfileCompleteness(
  userId: string,
): Promise<ProfileCompleteness | null> {
  const state = await loadProfileState(userId)
  return state?.completeness ?? null
}

export async function isProfileBrowseReady(userId: string): Promise<boolean> {
  const state = await loadProfileState(userId)
  return state?.browseReady ?? false
}

export async function isProfileActionReady(userId: string): Promise<boolean> {
  const state = await loadProfileState(userId)
  return state?.actionReady ?? false
}

export { canBrowse, canSendRequest, canSendMessage } from './completeness'

// ─── Onboarding state ─────────────────────────────────────

export async function applyOnboardingTransition(
  userId: string,
  current: OnboardingStatus,
  minimumMet: boolean,
): Promise<{
  status: OnboardingStatus
  changed: boolean
}> {
  const next = transitionOnboarding(current, minimumMet)

  if (!next.changed) {
    return {
      status: next.status,
      changed: false,
    }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_status: 'completed',
      onboarding_completed_at: next.completedAt,
    })
    .eq('id', userId)
    .eq('onboarding_status', 'pending')

  if (error) {
    logger.error('Failed to persist onboarding completion', {
      userId,
      error: error.message,
    })

    throw new AppError(
      ErrorCodes.INTERNAL,
      'Failed to persist onboarding completion',
      {
        cause: error,
      },
    )
  }

  return {
    status: 'completed',
    changed: true,
  }
}

export async function getPublicProfile(
  userId: string,
): Promise<Profile | null> {
  const supabase = await createServerSupabaseClient()

  // V10-BE-05 — public read uses the SAME canonical column list as the owner
  // read, so Profile and Preview cannot drift. The list is public-safe (no
  // email/phone/security fields); RLS still governs row visibility.
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_PROJECTION_COLUMNS)
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }

    logger.error('Failed to fetch public profile', {
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to fetch profile', {
      cause: error,
    })
  }

  return rowToProfile(data as Partial<Tables<'profiles'>>)
}

// ─── Canonical profile projection (V10-BE-05) ─────────────────────────────
// The one authoritative semantic profile model. Same canonical read columns as
// the legacy Profile readers; the mapper adds explicit field ownership and
// provider-origin metadata and (for the public variant) strips private fields.

export async function getProfileProjection(
  userId: string,
): Promise<OwnerProfileProjection | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('profiles')
    .select(PROJECTION_OWNER)
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }

    logger.error('Failed to fetch owner profile projection', {
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to fetch profile', {
      cause: error,
    })
  }

  return mapRowToOwnerProjection(data as ProfileRowLike)
}

export async function getPublicProfileProjection(
  userId: string,
): Promise<ProfileProjection | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_PROJECTION_COLUMNS)
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }

    logger.error('Failed to fetch public profile projection', {
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to fetch profile', {
      cause: error,
    })
  }

  return mapRowToPublicProjection(data as ProfileRowLike)
}

export async function updateProfile(
  userId: string,
  input: ProfileUpdateInput,
): Promise<Profile> {
  const supabase = await createServerSupabaseClient()

  const validated = profileUpdateSchema.parse(input)

  // S08 (§4.1) — the user edit boundary accepts only user-owned fields. The
  // schema STRIPS unknown keys (provider/system identity keys like fullName,
  // role, avatarUrl are deliberately not modeled), and pickUserEditable()
  // below re-checks the mapped DB update as THE final server-side gate, so a
  // forged payload can never reach the DB write. Keep detection explicitly so
  // a genuine attack is observed, not silently absorbed.
  const allowedUpdateKeys = new Set(Object.keys(profileUpdateSchema.shape))
  const attemptedNonEditable = (Object.keys(input) as string[]).filter(
    (key) => !allowedUpdateKeys.has(key),
  )

  if (attemptedNonEditable.length > 0) {
    logger.warn('Profile update attempted non-user-editable fields', {
      userId,
      attempted: attemptedNonEditable,
    })
  }

  const dbUpdate = inputToDbUpdate(validated)

  // THE final server-side gate — runs BEFORE any DB write.
  const safeUpdate = pickUserEditable(dbUpdate)

  const updatePayload: Database['public']['Tables']['profiles']['Update'] = {
    ...safeUpdate,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId)
    .select(PROJECTION_OWNER)
    .single()

  if (error) {
    logger.error('Failed to update profile', {
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to update profile', {
      cause: error,
    })
  }

  invalidateUserCache(userId)

  logger.info('Profile updated', { userId })

  const profile = rowToProfile(data as Partial<Tables<'profiles'>>)

  // Index what the canonical view would expose — best-effort only.
  syncSearchIndex([{ ...(profile as unknown as ProfileRow) }])

  return profile
}

// ─── Canonical owner-profile load (Session 04) ──────────────────────────────
// THE authoritative owner read for Profile, Preview and edit sections. One
// object feeds every surface; no page reconstructs the semantic model itself.
export async function loadConnectProfile(
  userId: string,
): Promise<ConnectProfileViewModel | null> {
  const supabase = await createServerSupabaseClient()

  // src7 S02 — the canonical select also carries the two columns the enriched
  // identity block derives from: `city` (user location) and
  // `provider_linked_in_identity` (LinkedIn member id → profile URL).
  const { data, error } = await supabase
    .from('profiles')
    .select(`${PROJECTION_OWNER}, city, provider_linked_in_identity`)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    if (error.code === 'PGRST116') return null
    logger.error('Failed to fetch connect profile', {
      userId,
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load profile', {
      cause: error,
    })
  }

  if (!data) return null

  const [experience, education] = await Promise.all([
    fetchProfileExperiences(userId),
    fetchProfileEducations(userId),
  ])

  // src7 S02 — REAL LinkedIn connection state from the connection row. When the
  // row is absent (or the read fails), every flag stays false — the UI must
  // never infer "connected" from anything other than this row.
  let provider: ProviderProfileStateModel = {
    linkedinConnected: false,
    identityAvailable: false,
    historyAvailable: false,
  }
  const { data: connection } = await supabase
    .from('profile_provider_connections')
    .select('provider_user_id, sync_state, last_success_at')
    .eq('user_id', userId)
    .eq('provider', 'linkedin')
    .maybeSingle()
  if (connection) {
    provider = {
      linkedinConnected: true,
      identityAvailable: Boolean(connection.provider_user_id),
      historyAvailable:
        connection.sync_state === 'synced' ||
        Boolean(connection.last_success_at),
    }
  }

  return rowToViewModel(data as unknown as ProfileRowLike, {
    experience,
    education,
    provider,
  })
}

// ─── Narrow section writes (Session 06/07) ──────────────────────────────────
// Each editor saves ONLY its logical group through a validated server action.
// The generic updateProfile stays for legacy/other consumers; section writes
// use the section schemas and re-run the field-ownership gate before writing.

/**
 * Best-effort Meilisearch hook. Fire-and-forget through the inline task runner
 * (ADR-001): search drift self-heals via the next reindex, so a profile write
 * must never wait on — or fail because of — the index. No await, no throw.
 */
function syncSearchIndex(rows: readonly ProfileRow[]): void {
  void runTask(() => syncProfileDocuments(rows), {
    id: 'meili-sync-profile',
    throwOnFailure: false,
  })
}

function removeFromSearchIndex(ids: readonly string[]): void {
  void runTask(() => deleteProfileDocuments(ids), {
    id: 'meili-delete-profile',
    throwOnFailure: false,
  })
}

async function persistUserUpdate(
  userId: string,
  dbUpdate: Record<string, unknown>,
): Promise<void> {
  const safeUpdate = pickUserEditable(dbUpdate)
  const updatePayload: Database['public']['Tables']['profiles']['Update'] = {
    ...(safeUpdate as Database['public']['Tables']['profiles']['Update']),
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabaseUpdate(userId, updatePayload)
  if (error) {
    logger.error('Failed to persist section update', {
      userId,
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to save changes', {
      cause: error,
    })
  }
  invalidateUserCache(userId)
}

async function supabaseUpdate(
  userId: string,
  updatePayload: Database['public']['Tables']['profiles']['Update'],
) {
  const supabase = await createServerSupabaseClient()
  return supabase.from('profiles').update(updatePayload).eq('id', userId)
}

export async function updateIntroductionSection(
  userId: string,
  input: IntroductionInput,
): Promise<void> {
  const validated = introductionSchema.parse(input)
  await persistUserUpdate(userId, {
    headline: validated.headline ?? null,
    bio: validated.bio ?? null,
    idea: validated.idea ?? null,
  })
}

export async function updateCollaborationSection(
  userId: string,
  input: CollaborationInput,
): Promise<void> {
  const validated = collaborationSchema.parse(input)
  await persistUserUpdate(userId, {
    offering: validated.offering,
    looking_for: validated.lookingFor,
  })
}

export async function removeAvatar(userId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      avatar_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) {
    logger.error('Failed to remove avatar', {
      userId,
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to remove photo', {
      cause: error,
    })
  }
  invalidateUserCache(userId)
}

export async function deleteAccount(userId: string): Promise<void> {
  const admin = getAdminSupabaseClient()

  if (!admin) {
    throw new AppError(ErrorCodes.INTERNAL, 'Admin client is not available')
  }

  // 1. Best-effort avatar storage cleanup before DB anonymization
  await deleteAvatarStorage(admin, userId)

  const supabase = await createServerSupabaseClient()

  const anonymizePayload = {
    full_name: 'Deleted User',
    bio: null,
    skills: [],
    availability: null,
    looking_for: {
      roles: [],
    },
    offering: {
      categories: [],
    },
    visibility: 'private',
    avatar_url: null,
    updated_at: new Date().toISOString(),
  } as Database['public']['Tables']['profiles']['Update']

  const { error: updateError } = await supabase
    .from('profiles')
    .update(anonymizePayload)
    .eq('id', userId)

  if (updateError) {
    logger.error('Failed to anonymise profile', {
      userId,
      error: updateError.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to delete account', {
      cause: updateError,
    })
  }

  const { error: msgError } = await supabase
    .from('messages')
    .update({
      content: '[deleted]',
    })
    .eq('sender_id', userId)

  if (msgError) {
    logger.warn('Failed to soft-delete messages', {
      userId,
      error: msgError.message,
    })
  }

  const { error: authError } = await admin.auth.admin.deleteUser(userId)

  if (authError) {
    logger.error('Failed to delete auth user', {
      userId,
      error: authError.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to delete account', {
      cause: authError,
    })
  }

  invalidateUserCache(userId)

  // The anonymized row is no longer eligible (visibility=private), and the
  // auth user is gone — purge any indexed copy. Best-effort, never throws.
  removeFromSearchIndex([userId])

  logger.info('Account deleted', { userId })
}

// ─── Avatar Storage Cleanup ─────────────────────────────────

/**
 * Delete all avatar objects for a user from storage.
 * Called during account deletion to ensure storage cleanup.
 */
async function deleteAvatarStorage(
  admin: ReturnType<typeof getAdminSupabaseClient>,
  userId: string,
): Promise<void> {
  const PAGE_SIZE = 100
  const MAX_PAGES = 10

  let offset = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    try {
      const { data: objects, error } = await admin.storage
        .from('avatars')
        .list(userId, { limit: PAGE_SIZE, offset })

      if (error || !objects || objects.length === 0) {
        break
      }

      const paths = objects
        .filter((o) => 'id' in o)
        .map((o) => `${userId}/${o.name}`)

      if (paths.length > 0) {
        await admin.storage.from('avatars').remove(paths)
      }

      if (objects.length < PAGE_SIZE) {
        break
      }
      offset += PAGE_SIZE
    } catch (err) {
      logger.warn('Avatar storage cleanup failed', {
        userId,
        error: err instanceof Error ? err.message : 'unknown',
      })
      break
    }
  }
}

// ─── Avatar Upload ───────────────────────────────────────

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

const ALLOWED_AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const

export async function getAvatarUploadUrl(
  userId: string,
  fileType: string,
): Promise<{
  uploadUrl: string
  path: string
}> {
  if (
    !ALLOWED_AVATAR_TYPES.includes(
      fileType as (typeof ALLOWED_AVATAR_TYPES)[number],
    )
  ) {
    logger.warn('Invalid avatar file type', {
      userId,
      fileType,
    })

    throw new AppError(
      ErrorCodes.VALIDATION,
      `Invalid file type. Allowed: ${ALLOWED_AVATAR_TYPES.join(', ')}`,
    )
  }

  const supabase = await createServerSupabaseClient()

  const bucket = 'avatars'

  const fileExt = fileType.split('/')[1] ?? 'png'

  const filePath = `${userId}/${randomUUID()}.${fileExt}`

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(filePath)

  if (error) {
    logger.error('Failed to create signed upload URL', {
      userId,
      error: error.message,
    })

    throw new AppError(
      ErrorCodes.EXTERNAL_SERVICE,
      'Failed to get upload URL',
      {
        cause: error,
      },
    )
  }

  return {
    uploadUrl: data.signedUrl,
    path: filePath,
  }
}

export async function confirmAvatarUpload(
  userId: string,
  path: string,
): Promise<Profile> {
  const supabase = await createServerSupabaseClient()

  // #92 — never bind a caller-supplied path just because it "looks valid".
  // The path MUST be server-derived from getAvatarUploadUrl({userId}/{uuid}.{ext}).
  const normalizedPath = path.replace(/^\/+/, '')

  const slashIndex = normalizedPath.indexOf('/')

  const ownerDir = slashIndex === -1 ? '' : normalizedPath.slice(0, slashIndex)

  const fileName =
    slashIndex === -1 ? normalizedPath : normalizedPath.slice(slashIndex + 1)

  if (ownerDir !== userId) {
    logger.warn('Avatar confirm: path owner mismatch', {
      userId,
      ownerDir,
    })
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      'Avatar path does not belong to your account.',
    )
  }

  const ext = fileName.includes('.') ? (fileName.split('.').pop() ?? '') : ''

  if (
    !ALLOWED_AVATAR_EXTENSIONS.includes(
      ext as (typeof ALLOWED_AVATAR_EXTENSIONS)[number],
    )
  ) {
    logger.warn('Avatar confirm: disallowed extension', { userId, ext })
    throw new AppError(ErrorCodes.VALIDATION, 'Invalid avatar file.')
  }

  // Verify the object actually exists in the user's avatar folder.
  const { data: listing, error: listError } = await supabase.storage
    .from('avatars')
    .list(ownerDir, { search: fileName, limit: 1 })

  const objectExists =
    !listError && (listing ?? []).some((file) => file.name === fileName)

  if (!objectExists) {
    logger.warn('Avatar confirm: object not found in storage', { userId })
    throw new AppError(ErrorCodes.NOT_FOUND, 'Uploaded avatar not found.')
  }

  const publicUrl = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${normalizedPath}`

  // avatar_url is provider-owned under S08 (§4.1), but this is the DEDICATED
  // user avatar flow (signed upload + server-validated storage path, #92) — the
  // sanctioned way a user replaces their provider picture. It is NOT the generic
  // profile update path, which is gated by pickUserEditable(). Origin remains
  // derivable from the stored URL (projection resolveAvatarOrigin).
  const updatePayload: Database['public']['Tables']['profiles']['Update'] = {
    avatar_url: publicUrl,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId)
    .select(PROJECTION_OWNER)
    .single()

  if (error) {
    logger.error('Failed to confirm avatar upload', {
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to update avatar', {
      cause: error,
    })
  }

  invalidateUserCache(userId)

  return rowToProfile(data as Partial<Tables<'profiles'>>)
}

// ─── Export Requests ──────────────────────────────────────

export async function requestExport(userId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const admin = getAdminSupabaseClient()

  if (!admin) {
    throw new AppError(ErrorCodes.INTERNAL, 'Admin client is not available')
  }

  const { data: existing, error: checkError } = await supabase
    .from('export_requests')
    .select('id, status')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle<ExportRequestRow>()

  if (checkError && checkError.code !== 'PGRST116') {
    logger.error('Failed to check existing export request', {
      userId,
      error: checkError.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to request export', {
      cause: checkError,
    })
  }

  if (existing) {
    logger.debug('Export request already pending', { userId })
    return
  }

  const insertPayload: ExportRequestInsert = {
    user_id: userId,
    status: 'pending',
    created_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('export_requests').insert(insertPayload)

  if (error) {
    logger.error('Failed to create export request', {
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to request export', {
      cause: error,
    })
  }

  await runTask(
    async () => {
      let userEmail: string | undefined

      try {
        const { data: userData, error: userError } =
          await admin.auth.admin.getUserById(userId)

        if (!userError) {
          userEmail = userData.user.email
        }
      } catch (err) {
        logger.warn('Failed to fetch user email for export alert', {
          userId,
          error: err,
        })
      }

      // HOST-ASYNC-03 — Slack is an external side effect; enqueue to the
      // durable slack_alerts outbox (dedupe: one alert per export request)
      // instead of POSTing inline, so a crash can never silently drop it.
      // #113 — idempotencyKey equals the dedupe_key; if this task retries,
      // the 23505 collision reuses the existing row (no duplicate alert).
      await enqueueSlackAlert({
        dedupeKey: `export-request-${userId}`,
        text:
          `📤 **Export Request**\n` +
          `User: ${userEmail || userId}\n` +
          `Requested at: ${new Date().toISOString()}\n` +
          `Please run SQL to export data and email to the user.`,
      })
    },
    {
      id: `export-request-${userId}`,
      idempotencyKey: `export-request-${userId}`,
    },
  )

  logger.info('Export request created', { userId })
}
