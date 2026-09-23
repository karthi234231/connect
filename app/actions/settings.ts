// src/app/actions/settings.ts
// Settings persistence boundary. Every action authenticates via requireUser and
// validates with zod, then persists ONLY to columns/tables that already exist
// in types/database.ts. Settings without a backend (e.g. "Product updates")
// render but are documented with a TODO — no new tables are ever written.
'use server'

import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { toErrorPayload } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { emailSchema, nameSchema } from '@/lib/validation'
import { createNotificationsRepository } from '@/services/notifications/notifications.repository'
import { getProfile, updateProfile } from '@/services/profiles/service'
import {
  notificationPrefUpdates,
  resolveNotificationToggleFlags,
  type NotificationToggleFlags,
  type StoredNotificationPref,
} from '@/app/dashboard/settings/notification-model'

export type SettingsActionResult =
  { ok: true; error: null } | { ok: false; error: string }

const notificationFlagsSchema = z
  .object({
    matches: z.boolean().optional(),
    messages: z.boolean().optional(),
    reminders: z.boolean().optional(),
    updates: z.boolean().optional(),
  })
  .strict()

const privacyFlagsSchema = z
  .object({
    public: z.boolean().optional(),
    status: z.boolean().optional(),
    requests: z.boolean().optional(),
  })
  .strict()

const accountSettingsSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
  })
  .strict()

function succeed(): SettingsActionResult {
  return { ok: true, error: null }
}

function fail(scope: string, error: unknown): SettingsActionResult {
  logger.error(`Settings action failed: ${scope}`, { error })
  return { ok: false, error: toErrorPayload(error).message }
}

// ─── Notifications ──────────────────────────────────────────────────────────

export async function getNotificationSettingsAction(): Promise<{
  flags: NotificationToggleFlags
}> {
  const userId = await requireUser()
  const supabase = await createServerSupabaseClient()
  const repository = createNotificationsRepository(supabase)
  const prefs = await repository.listPreferences(userId)

  const stored: StoredNotificationPref[] = prefs.map((pref) => ({
    type: pref.type,
    enabled: pref.enabled,
  }))

  return { flags: resolveNotificationToggleFlags(stored) }
}

export async function updateNotificationSettingsAction(
  flags: NotificationToggleFlags,
): Promise<SettingsActionResult> {
  const parsed = notificationFlagsSchema.safeParse(flags)

  if (!parsed.success) {
    logger.warn('updateNotificationSettingsAction: invalid payload', {
      error: parsed.error,
    })
    return { ok: false, error: toErrorPayload(parsed.error).message }
  }

  try {
    const userId = await requireUser()
    const updates = notificationPrefUpdates(parsed.data)

    // `updates` (Product updates) has no notification_type enum value yet, so
    // notificationPrefUpdates never emits a row for it — TODO persists it once
    // a matching notification_type exists. Never invent a type.
    if (updates.length > 0) {
      const supabase = await createServerSupabaseClient()
      const repository = createNotificationsRepository(supabase)
      const channels = { in_app: true, email: true, push: true }
      for (const update of updates) {
        await repository.upsertPreference(
          userId,
          update.type,
          channels,
          update.enabled,
        )
      }
    }

    return succeed()
  } catch (error) {
    return fail('updateNotificationSettings', error)
  }
}

// ─── Privacy ────────────────────────────────────────────────────────────────

export async function getPrivacySettingsAction(): Promise<{
  flags: { public: boolean; status: boolean; requests: boolean }
}> {
  const userId = await requireUser()
  const profile = await getProfile(userId)

  return {
    flags: {
      // `public` maps to the real profiles.visibility column.
      public: profile?.visibility === 'public',
      // No stored online-status / message-request columns exist yet — the
      // flags keep their on-screen defaults until a backend lands (TODO).
      status: true,
      requests: true,
    },
  }
}

export async function updatePrivacySettingsAction(flags: {
  public?: boolean
  status?: boolean
  requests?: boolean
}): Promise<SettingsActionResult> {
  const parsed = privacyFlagsSchema.safeParse(flags)

  if (!parsed.success) {
    return { ok: false, error: toErrorPayload(parsed.error).message }
  }

  try {
    const userId = await requireUser()
    // Only `public` maps to an existing column (profiles.visibility). The
    // status/requests flags have no backing store yet — remain TODO, never
    // written to a fabricated column.
    if (parsed.data.public !== undefined) {
      await updateProfile(userId, {
        visibility: parsed.data.public ? 'public' : 'private',
      })
    }

    return succeed()
  } catch (error) {
    return fail('updatePrivacySettings', error)
  }
}

// ─── Account ────────────────────────────────────────────────────────────────

/**
 * Provider-identity read for the Account settings page. Name comes from the
 * profile; email comes from the auth user (the only source that has it) rather
 * than a fabricated field.
 */
export async function getAccountSettingsAction(): Promise<{
  name: string
  email: string | null
}> {
  const userId = await requireUser()
  const profile = await getProfile(userId)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return {
    name: profile?.fullName ?? '',
    email: user?.email ?? null,
  }
}

/**
 * Account identity update is intentionally NOT supported: fullName/email are
 * provider-owned keys (LinkedIn OIDC) with no user-writable column. P0-10 — this
 * now returns an explicit failure instead of a false success, so the UI cannot
 * claim a change that never happened.
 */
export async function updateAccountSettingsAction(input: {
  name?: string
  email?: string
}): Promise<SettingsActionResult> {
  const parsed = accountSettingsSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: toErrorPayload(parsed.error).message }
  }

  try {
    await requireUser()
    return {
      ok: false,
      error: 'Your name and email come from LinkedIn and cannot be edited here.',
    }
  } catch (error) {
    return fail('updateAccountSettings', error)
  }
}

/**
 * Pause visibility (P0-10 / P0-18). The product has no `deactivated_at`
 * lifecycle column yet, so this is HONESTLY scoped to what it does: make the
 * profile private. It is not advertised as an irreversible account deletion.
 * (A true deactivation lifecycle requires a migration — tracked separately.)
 */
export async function deactivateAccountAction(): Promise<SettingsActionResult> {
  try {
    const userId = await requireUser()
    await updateProfile(userId, { visibility: 'private' })
    return succeed()
  } catch (error) {
    return fail('deactivateAccount', error)
  }
}
