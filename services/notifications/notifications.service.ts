// src/services/notifications/notifications.service.ts
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

import {
  createNotificationsRepository,
  type CreateNotificationInput,
  type NotificationsRepository,
} from './notifications.repository'
import { sendNotificationEmail } from './email'
import {
  CHANNEL_ELIGIBILITY,
  DEFAULT_CHANNEL_PREFS,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_SETTINGS,
  NOTIFICATION_TYPES,
  type Notification,
  type NotificationChannel,
  type NotificationPreference,
  type NotificationSettings,
  type NotificationType,
  type PreferenceMatrix,
} from './notifications.types'

import {
  buildActionableNotifications,
  type ActionableNotification,
} from './notification-actions'

export class NotificationsService {
  private readonly repo: NotificationsRepository

  constructor(repo?: NotificationsRepository) {
    this.repo = repo ?? createNotificationsRepository(getAdminSupabaseClient()!)
  }

  async listForUser(userId: string, limit = 50): Promise<Notification[]> {
    return this.repo.listForUser(userId, limit)
  }

  /**
   * V10-BE-10 — inbox rows resolved to a single safe canonical action each.
   * Resolution is authoritative (server-side): stale/deleted/blocked entities
   * degrade to the inbox, never to an arbitrary surface.
   */
  async listActionableForUser(
    userId: string,
    limit = 50,
  ): Promise<ActionableNotification[]> {
    const rows = await this.repo.listForUser(userId, limit)
    return buildActionableNotifications(userId, rows)
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repo.getUnreadCount(userId)
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.repo.markAsRead(notificationId, userId)
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repo.markAllAsRead(userId)
  }

  /**
   * Emit a notification if the recipient has the preference enabled.
   * Channel delivery respects eligibility + per-type channel flags and
   * quiet hours (quiet hours suppress only non-security channels).
   */
  async notify(
    userId: string,
    input: CreateNotificationInput,
  ): Promise<Notification | null> {
    const pref = await this.repo.getPreference(userId, input.type)
    const enabled = pref?.enabled ?? DEFAULT_NOTIFICATION_PREFS[input.type]
    if (!enabled) return null

    const settings = (await this.repo.getSettings(userId)) ?? DEFAULT_SETTINGS
    const storedChannels = pref
      ? { in_app: pref.in_app, email: pref.email, push: pref.push }
      : undefined
    const channels = this.determineChannels(storedChannels, input.type)
    const quiet = this.isQuietHours(settings)
    // #184 — security-sensitive notifications bypass quiet hours entirely.
    const isSecurity = input.security === true

    // In-app inbox row is always eligible unless the type is in-app-disabled.
    if (!channels.in_app) return null
    const notification = await this.repo.insert(userId, input)
    if (notification) {
      if (channels.email && !(quiet && !isSecurity)) {
        // Durable outbox (finding #8): the inbound request must not terminate
        // before email delivery is guaranteed. We resolve the recipient once
        // here and persist an outbox row that a worker drains independently of
        // this request lifecycle.
        await this.enqueueEmail(userId, notification.id)
      }
    }
    return notification
  }

  private async enqueueEmail(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    const supabase = getAdminSupabaseClient()
    let email: string | null = null
    try {
      const { data } = await supabase.auth.admin.getUserById(userId)
      email = data.user?.email ?? null
    } catch {
      email = null
    }
    await this.repo.enqueueEmailDelivery({
      notification_id: notificationId,
      user_id: userId,
      to_email: email,
    })
  }

  private determineChannels(
    stored: Record<NotificationChannel, boolean> | undefined,
    type: NotificationType,
  ): Record<NotificationChannel, boolean> {
    const base = stored ?? DEFAULT_CHANNEL_PREFS[type]
    const eligible = new Set(CHANNEL_ELIGIBILITY[type])
    return {
      in_app: eligible.has('in_app') && base.in_app,
      email: eligible.has('email') && base.email,
      push: eligible.has('push') && base.push,
    }
  }

  private isQuietHours(settings: NotificationSettings): boolean {
    if (!settings.quiet_hours_enabled) return false
    if (!settings.quiet_hours_start || !settings.quiet_hours_end) return false
    const zone = settings.quiet_hours_timezone ?? 'UTC'
    const now = new Date()
    // #126 — derive the current wall-clock time in the target timezone using
    // Intl.DateTimeFormat, which handles DST correctly. Manual UTC offset
    // arithmetic breaks during transitions. Falls back to UTC on invalid zone.
    let h: number
    let m: number
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(now)
      h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
      m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
    } catch {
      // Unknown timezone — fall back to UTC
      h = now.getUTCHours()
      m = now.getUTCMinutes()
    }
    const minutes = h * 60 + m
    const start = this.toMinutes(settings.quiet_hours_start)
    const end = this.toMinutes(settings.quiet_hours_end)
    if (start <= end) return minutes >= start && minutes < end
    // Overnight window (e.g. 22:00 → 07:00).
    return minutes >= start || minutes < end
  }

  private toMinutes(time: string): number {
    const [h, m] = time.split(':').map((n) => Number(n))
    return (h || 0) * 60 + (m || 0)
  }

  async getPreference(
    userId: string,
    type: NotificationType,
  ): Promise<NotificationPreference | null> {
    return this.repo.getPreference(userId, type)
  }

  /**
   * Set the full per-type matrix: master toggle + per-channel flags.
   * Channel flags outside the type's eligibility set are ignored on write.
   */
  async setPreference(
    userId: string,
    type: NotificationType,
    channels: Record<NotificationChannel, boolean>,
    enabled: boolean,
  ): Promise<void> {
    const eligible = new Set(CHANNEL_ELIGIBILITY[type])
    const clean: Record<NotificationChannel, boolean> = {
      in_app: eligible.has('in_app') && channels.in_app,
      email: eligible.has('email') && channels.email,
      push: eligible.has('push') && channels.push,
    }
    await this.repo.upsertPreference(userId, type, clean, enabled)
  }

  async listPreferences(userId: string): Promise<NotificationPreference[]> {
    return this.repo.listPreferences(userId)
  }

  /** Resolved per-type matrix (defaults merged for any missing rows). */
  async getPreferenceMatrix(
    userId: string,
  ): Promise<Record<NotificationType, PreferenceMatrix>> {
    const rows = await this.repo.listPreferences(userId)
    const byType = new Map(rows.map((r) => [r.type, r]))
    const result = {} as Record<NotificationType, PreferenceMatrix>
    for (const type of NOTIFICATION_TYPES) {
      const row = byType.get(type)
      const defaults = DEFAULT_CHANNEL_PREFS[type]
      result[type] = {
        enabled: row?.enabled ?? DEFAULT_NOTIFICATION_PREFS[type],
        channels: row
          ? { in_app: row.in_app, email: row.email, push: row.push }
          : { ...defaults },
      }
    }
    return result
  }

  async getSettings(userId: string): Promise<NotificationSettings> {
    return this.repo.ensureSettings(userId)
  }

  async updateSettings(
    userId: string,
    patch: Partial<NotificationSettings>,
  ): Promise<NotificationSettings> {
    return this.repo.updateSettings(userId, patch)
  }

  async cleanupExpiredNotifications(): Promise<number> {
    const count = await this.repo.deleteExpiredNotifications()
    if (count > 0) {
      logger.info('Cleaned up expired notifications', { count })
    }
    return count
  }
}

let singleton: NotificationsService | null = null

export function getNotificationsService(): NotificationsService {
  if (!singleton) {
    singleton = new NotificationsService()
  }
  return singleton
}

/**
 * Durable outbox worker (finding #8).
 *
 * Drains `notification_deliveries` rows for the email channel and advances the
 * state machine `pending → processing → sent` (with `retry_wait` backoff,
 * then `failed` after MAX_ATTEMPTS). Runs independently of the request that
 * created the notification, so a crash or early request termination can never
 * silently drop an email.
 */
export const NOTIFICATION_DELIVERY_MAX_ATTEMPTS = 5

export async function processNotificationDeliveries(
  repo: NotificationsRepository = createNotificationsRepository(
    getAdminSupabaseClient()!,
  ),
  limit = 20,
): Promise<{ processed: number; sent: number; failed: number }> {
  const due = await repo.claimDueDeliveries(limit)
  let sent = 0
  let failed = 0
  let processed = 0

  for (const delivery of due) {
    if (delivery.channel !== 'email') {
      // Non-email channels are not implemented; retire them silently.
      await repo.markFailed(
        delivery.id,
        'Unsupported delivery channel',
        NOTIFICATION_DELIVERY_MAX_ATTEMPTS,
      )
      failed += 1
      continue
    }

    const claimed = await repo.markProcessing(delivery.id)
    if (!claimed) continue // another worker already owns this row

    try {
      const notification = await repo.getNotificationById(
        delivery.notification_id,
      )
      if (!notification) {
        await repo.markFailed(
          delivery.id,
          'Notification row missing',
          NOTIFICATION_DELIVERY_MAX_ATTEMPTS,
        )
        failed += 1
        continue
      }

      const to = delivery.to_email
      if (!to) {
        // No resolvable recipient: nothing to send. Fail so it is visible and
        // not retried forever.
        await repo.markFailed(
          delivery.id,
          'No recipient email',
          NOTIFICATION_DELIVERY_MAX_ATTEMPTS,
        )
        failed += 1
        continue
      }

      const result = await sendNotificationEmail(to, notification)
      if (result.sent) {
        await repo.markSent(delivery.id)
        sent += 1
      } else {
        await repo.markFailed(
          delivery.id,
          result.error ?? 'Email send failed',
          NOTIFICATION_DELIVERY_MAX_ATTEMPTS,
        )
        failed += 1
      }
    } catch (error) {
      logger.error('Notification delivery worker error', {
        deliveryId: delivery.id,
        error: error instanceof Error ? error.message : String(error),
      })
      await repo.markFailed(
        delivery.id,
        error instanceof Error ? error.message : String(error),
        NOTIFICATION_DELIVERY_MAX_ATTEMPTS,
      )
      failed += 1
    }
    processed += 1
  }

  return { processed, sent, failed }
}
