// src/app/actions/notifications.ts
// Notification settings + inbox actions. Identity from the verified session;
// preferences are merged over the canonical defaults so a user with no rows
// still sees the full matrix.
'use server'

import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { AppError, ErrorCodes } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  buildActionableNotifications,
  type ActionableNotificationContext,
} from '@/services/notifications/notification-actions'
import { createNotificationsRepository } from '@/services/notifications/notifications.repository'
import {
  DEFAULT_CHANNEL_PREFS,
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_TYPES,
  type Notification,
  type NotificationChannel,
  type NotificationSettings,
  type NotificationType,
  type PreferenceMatrix,
} from '@/services/notifications/notifications.types'

/** Inbox window for the actionable-notification center. */
const INBOX_LIMIT = 50

/**
 * Inbox row as the center consumes it: the columns it renders plus the resolved
 * action context (`null` when the referenced entity is gone — the row then
 * degrades to a read-only entry instead of an invented destination).
 */
export interface ActionableNotificationItem {
  notification: Pick<
    Notification,
    'id' | 'user_id' | 'type' | 'title' | 'body' | 'read_at' | 'created_at'
  >
  context: ActionableNotificationContext | null
}

const notificationTypeSchema = z.enum(
  NOTIFICATION_TYPES as [NotificationType, ...NotificationType[]],
)

const channelSchema = z
  .object({
    in_app: z.boolean(),
    email: z.boolean(),
    push: z.boolean(),
  })
  .strict()

const preferenceInputSchema = z
  .object({
    type: notificationTypeSchema,
    channels: channelSchema,
    enabled: z.boolean(),
  })
  .strict()

/** RLS-scoped repository bound to the caller's session client. */
async function notificationsRepo() {
  return createNotificationsRepository(await createServerSupabaseClient())
}

export async function getNotificationPreferences(): Promise<
  Record<NotificationType, PreferenceMatrix>
> {
  const userId = await requireUser()
  const repo = await notificationsRepo()

  const rows = await repo.listPreferences(userId)

  const matrix = {} as Record<NotificationType, PreferenceMatrix>

  for (const type of NOTIFICATION_TYPES) {
    matrix[type] = {
      enabled: DEFAULT_NOTIFICATION_PREFS[type],
      channels: { ...DEFAULT_CHANNEL_PREFS[type] } as Record<
        NotificationChannel,
        boolean
      >,
    }
  }

  for (const row of rows) {
    matrix[row.type] = {
      enabled: row.enabled,
      channels: { in_app: row.in_app, email: row.email, push: row.push },
    }
  }

  return matrix
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const userId = await requireUser()
  const repo = await notificationsRepo()
  return repo.ensureSettings(userId)
}

export async function setNotificationPreference(
  type: NotificationType,
  channels: Record<NotificationChannel, boolean>,
  enabled: boolean,
): Promise<void> {
  const userId = await requireUser()

  const parsed = preferenceInputSchema.safeParse({ type, channels, enabled })

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'That notification preference is not valid.',
    )
  }

  const repo = await notificationsRepo()

  await repo.upsertPreference(
    userId,
    parsed.data.type,
    parsed.data.channels,
    parsed.data.enabled,
  )
}

export async function updateNotificationSettings(
  patch: Partial<NotificationSettings>,
): Promise<void> {
  const userId = await requireUser()

  // Owner columns are never caller-supplied: strip them before the write.
  const { user_id: _userId, updated_at: _updatedAt, ...safePatch } = patch

  const repo = await notificationsRepo()
  await repo.updateSettings(userId, safePatch)
}

export async function getUnreadNotificationCount(): Promise<number> {
  const userId = await requireUser()
  const repo = await notificationsRepo()
  return repo.getUnreadCount(userId)
}

export async function listActionableNotifications(): Promise<
  ActionableNotificationItem[]
> {
  const userId = await requireUser()
  const repo = await notificationsRepo()
  const rows = await repo.listForUser(userId, INBOX_LIMIT)

  const actionable = await buildActionableNotifications(userId, rows)

  return actionable.map((item) => ({
    notification: item.notification,
    context: item.context ?? null,
  }))
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await requireUser()
  const repo = await notificationsRepo()
  await repo.markAllAsRead(userId)
}
