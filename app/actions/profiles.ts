// src/app/actions/profiles.ts
// Profile edit, avatar, GDPR and block-list actions. The user edit boundary is
// the S08 gate: only user-owned fields are modelled by profileUpdateSchema, so
// a forged provider/system key is stripped before any write; every section
// write re-checks ownership inside the service.
'use server'

import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { invalidateUserCache } from '@/lib/cache'
import { AppError, ErrorCodes, toErrorPayload } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { profileVisibilitySchema } from '@/lib/validation'
import { requestEraseJob } from '@/services/gdpr/erase'
import { requestExportJob } from '@/services/gdpr/export'
import {
  collaborationSchema,
  introductionSchema,
  profileUpdateSchema,
  type CollaborationInput,
  type IntroductionInput,
  type ProfileUpdateInput,
} from '@/services/profiles/profile.schema'
import {
  confirmAvatarUpload,
  getAvatarUploadUrl,
  loadConnectProfile,
  removeAvatar,
  updateCollaborationSection,
  updateIntroductionSection,
  updateProfile,
} from '@/services/profiles/service'
import { unblockUser } from '@/services/safety/safety.service'

export type ProfileActionResult =
  { ok: true; error: null } | { ok: false; error: string }

export type AvatarUploadResult =
  | { ok: true; error: null; url: string; path: string }
  | { ok: false; error: string }

const avatarTypeSchema = z
  .string()
  .trim()
  .regex(/^image\/(png|jpe?g|webp)$/, 'Unsupported image type.')

const avatarPathSchema = z.object({
  path: z.string().trim().min(1).max(500),
})

function succeed(): ProfileActionResult {
  return { ok: true, error: null }
}

function fail(scope: string, error: unknown): ProfileActionResult {
  logger.error(`Profile action failed: ${scope}`, { error })
  return { ok: false, error: toErrorPayload(error).message }
}

export async function updateProfileAction(
  input: ProfileUpdateInput,
): Promise<ProfileActionResult> {
  const userId = await requireUser()

  // Unknown keys (fullName / role / avatarUrl / app_role / id) are STRIPPED by
  // profileUpdateSchema — they can never reach the service through this path.
  const parsed = profileUpdateSchema.safeParse(input ?? {})

  if (!parsed.success) {
    logger.warn('updateProfileAction: invalid payload', {
      userId,
      issues: parsed.error.issues.length,
    })
    return { ok: false, error: toErrorPayload(parsed.error).message }
  }

  try {
    await updateProfile(userId, parsed.data)
    invalidateUserCache(userId)
    return succeed()
  } catch (error) {
    return fail('updateProfile', error)
  }
}

export async function updateVisibilityAction(
  visibility: string,
): Promise<void> {
  const userId = await requireUser()

  const parsed = profileVisibilitySchema.safeParse(visibility)

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'That visibility setting is not valid.',
    )
  }

  await updateProfile(userId, { visibility: parsed.data })
  invalidateUserCache(userId)
}

export async function updateIntroductionAction(
  input: IntroductionInput,
): Promise<ProfileActionResult> {
  const userId = await requireUser()

  const parsed = introductionSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: toErrorPayload(parsed.error).message }
  }

  try {
    await updateIntroductionSection(userId, parsed.data)
    invalidateUserCache(userId)
    return succeed()
  } catch (error) {
    return fail('updateIntroduction', error)
  }
}

export async function updateCollaborationAction(
  input: CollaborationInput,
): Promise<ProfileActionResult> {
  const userId = await requireUser()

  const parsed = collaborationSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: toErrorPayload(parsed.error).message }
  }

  try {
    await updateCollaborationSection(userId, parsed.data)
    invalidateUserCache(userId)
    return succeed()
  } catch (error) {
    return fail('updateCollaboration', error)
  }
}

export async function getAvatarUploadAction(
  fileType: string,
): Promise<AvatarUploadResult> {
  const userId = await requireUser()

  const parsed = avatarTypeSchema.safeParse(fileType)

  if (!parsed.success) {
    return { ok: false, error: toErrorPayload(parsed.error).message }
  }

  try {
    const upload = await getAvatarUploadUrl(userId, parsed.data)
    return { ok: true, error: null, url: upload.uploadUrl, path: upload.path }
  } catch (error) {
    return { ok: false, error: toErrorPayload(error).message }
  }
}

export async function confirmAvatarUploadAction(
  path: string,
): Promise<ProfileActionResult> {
  const userId = await requireUser()

  const parsed = avatarPathSchema.safeParse({ path })

  if (!parsed.success) {
    return { ok: false, error: toErrorPayload(parsed.error).message }
  }

  try {
    await confirmAvatarUpload(userId, parsed.data.path)
    invalidateUserCache(userId)
    return succeed()
  } catch (error) {
    return fail('confirmAvatarUpload', error)
  }
}

export async function removeAvatarAction(): Promise<ProfileActionResult> {
  const userId = await requireUser()

  try {
    await removeAvatar(userId)
    invalidateUserCache(userId)
    return succeed()
  } catch (error) {
    return fail('removeAvatar', error)
  }
}

export async function unblockUserAction(blockedUserId: string): Promise<void> {
  const userId = await requireUser()

  const parsed = z.string().uuid().safeParse(blockedUserId)

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'That account could not be unblocked.',
    )
  }

  await unblockUser(userId, parsed.data)
  invalidateUserCache(userId)
}

/** ADR-006 — minimal self-service export request (async job, email delivery). */
export async function requestGdprExportAction(): Promise<{
  requestId: string
  alreadyPending: boolean
}> {
  const userId = await requireUser()
  return requestExportJob(userId)
}

/** ADR-006 — minimal self-service delete request (async hard erase). */
export async function requestGdprEraseAction(): Promise<{
  requestId: string
  alreadyPending: boolean
}> {
  const userId = await requireUser()
  return requestEraseJob(userId)
}

/**
 * Owner read of the canonical ConnectProfileViewModel (experience + education
 * included). Used by the profile edit surface to render the read-only
 * experience/education sections — these are provider-synced (LinkedIn) and have
 * no user-write path today, so they are displayed only, never edited.
 */
export type OwnConnectProfileResult = Awaited<
  ReturnType<typeof loadConnectProfile>
>

export async function getOwnConnectProfileAction(): Promise<OwnConnectProfileResult> {
  const userId = await requireUser()
  return loadConnectProfile(userId)
}
