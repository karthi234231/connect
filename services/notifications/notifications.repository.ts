// src/services/notifications/notifications.repository.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

import { DEFAULT_SETTINGS } from './notifications.types'
import type {
  Notification,
  NotificationChannel,
  NotificationInsert,
  NotificationPreference,
  NotificationSettings,
  NotificationType,
} from './notifications.types'

export interface NotificationsRepository {
  listForUser(userId: string, limit?: number): Promise<Notification[]>
  getUnreadCount(userId: string): Promise<number>
  insert(
    userId: string,
    input: CreateNotificationInput,
  ): Promise<Notification | null>
  markAsRead(notificationId: string, userId: string): Promise<void>
  markAllAsRead(userId: string): Promise<void>
  getPreference(
    userId: string,
    type: NotificationType,
  ): Promise<NotificationPreference | null>
  upsertPreference(
    userId: string,
    type: NotificationType,
    channels: Record<NotificationChannel, boolean>,
    enabled: boolean,
  ): Promise<void>
  listPreferences(userId: string): Promise<NotificationPreference[]>
  getSettings(userId: string): Promise<NotificationSettings | null>
  ensureSettings(userId: string): Promise<NotificationSettings>
  updateSettings(
    userId: string,
    patch: Partial<NotificationSettings>,
  ): Promise<NotificationSettings>
  enqueueEmailDelivery(params: {
    notification_id: string
    user_id: string
    to_email: string | null
  }): Promise<void>
  claimDueDeliveries(limit?: number): Promise<DeliveryRecord[]>
  markProcessing(id: string): Promise<boolean>
  markSent(id: string, providerMessageId?: string): Promise<void>
  markFailed(id: string, error: string, maxAttempts: number): Promise<void>
  getNotificationById(id: string): Promise<Notification | null>
  deleteExpiredNotifications(): Promise<number>
}

/**
 * Lease for a `processing` delivery claim. A worker that crashes after
 * marking a row `processing` cannot advance it; the row must be reclaimed by
 * a later run. `updated_at` is written as the claim heartbeat as each claim
 * is taken, and any `processing` row older than this lease is treated as
 * abandoned and recoverable (HOST-ASYNC-01).
 */
export const PROCESSING_LEASE_MS = 5 * 60 * 1000

export interface CreateNotificationInput {
  type: NotificationType
  entityType?: string
  entityId?: string
  title: string
  body?: string
  dedupeKey?: string
  expiresAt?: string
  /** #184 — security-sensitive notifications bypass quiet hours. */
  security?: boolean
}

export interface DeliveryRecord {
  id: string
  notification_id: string
  user_id: string
  channel: string
  status: string
  attempts: number
  to_email: string | null
  provider_message_id: string | null
  last_error: string | null
  next_attempt_at: string
  created_at: string
  updated_at: string
}

export function createNotificationsRepository(
  client: SupabaseClient<Database>,
): NotificationsRepository {
  const table = client.from('notifications')
  const prefsTable = client.from('notification_preferences')
  const settingsTable = client.from('notification_settings')
  const deliveryTable = client.from('notification_deliveries')

  const PREF_COLUMNS =
    'id,user_id,type,enabled,in_app,email,push,created_at,updated_at'
  const SETTINGS_COLUMNS =
    'user_id,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,quiet_hours_timezone,digest_cadence,digest_hour,digest_timezone,security_alerts,updated_at'

  return {
    async listForUser(userId: string, limit = 50): Promise<Notification[]> {
      const { data, error } = await table
        .select(
          'id,user_id,type,entity_type,entity_id,title,body,read_at,dedupe_key,expires_at,created_at',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as Notification[]
    },

    async getUnreadCount(userId: string): Promise<number> {
      const { count, error } = await table
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null)
      if (error) throw error
      return count ?? 0
    },

    async insert(
      userId: string,
      input: CreateNotificationInput,
    ): Promise<Notification | null> {
      const row: NotificationInsert = {
        user_id: userId,
        type: input.type,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        title: input.title,
        body: input.body ?? null,
        dedupe_key: input.dedupeKey ?? null,
        expires_at: input.expiresAt ?? null,
      }
      // Dedupe is DB-enforced by the recipient-scoped partial unique index
      // (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL. A 23505 on the
      // single-statement insert is a lost race or duplicate: return null.
      const { data, error } = await table
        .insert(row)
        .select(
          'id,user_id,type,entity_type,entity_id,title,body,read_at,dedupe_key,expires_at,created_at',
        )
        .single()
      if (error) {
        if (error.code === '23505' && input.dedupeKey) return null
        throw error
      }
      return data as Notification
    },

    async markAsRead(notificationId: string, userId: string): Promise<void> {
      const { error } = await table
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId)
      if (error) throw error
    },

    async markAllAsRead(userId: string): Promise<void> {
      const { error } = await table
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null)
      if (error) throw error
    },

    async getPreference(
      userId: string,
      type: NotificationType,
    ): Promise<NotificationPreference | null> {
      const { data, error } = await prefsTable
        .select(PREF_COLUMNS)
        .eq('user_id', userId)
        .eq('type', type)
        .maybeSingle()
      if (error) throw error
      return data as NotificationPreference | null
    },

    async upsertPreference(
      userId: string,
      type: NotificationType,
      channels: Record<NotificationChannel, boolean>,
      enabled: boolean,
    ): Promise<void> {
      const { error } = await prefsTable.upsert(
        {
          user_id: userId,
          type,
          enabled,
          in_app: channels.in_app,
          email: channels.email,
          push: channels.push,
        },
        { onConflict: 'user_id,type' },
      )
      if (error) throw error
    },

    async listPreferences(userId: string): Promise<NotificationPreference[]> {
      const { data, error } = await prefsTable
        .select(PREF_COLUMNS)
        .eq('user_id', userId)
      if (error) throw error
      return (data ?? []) as NotificationPreference[]
    },

    async getSettings(userId: string): Promise<NotificationSettings | null> {
      const { data, error } = await settingsTable
        .select(SETTINGS_COLUMNS)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data as NotificationSettings | null
    },

    async ensureSettings(userId: string): Promise<NotificationSettings> {
      const existing = await this.getSettings(userId)
      if (existing) return existing
      // Upsert on the user_id PK: concurrent first-access inserts one row,
      // losers of the race read the winner's row instead of crashing (23505).
      // updated_at is omitted so the DB default/timestamp logic applies.
      const { updated_at: _ignored, ...defaults } = DEFAULT_SETTINGS
      const row = { ...defaults, user_id: userId }
      const { data, error } = await settingsTable
        .upsert(row, { onConflict: 'user_id' })
        .select(SETTINGS_COLUMNS)
        .single()
      if (error) throw error
      return data as NotificationSettings
    },

    async updateSettings(
      userId: string,
      patch: Partial<NotificationSettings>,
    ): Promise<NotificationSettings> {
      // Ensure the row exists first (race-safe upsert) so a first-time update
      // cannot fail with 0 rows.
      await this.ensureSettings(userId)
      const { data, error } = await settingsTable
        .update({ ...patch, user_id: userId })
        .eq('user_id', userId)
        .select(SETTINGS_COLUMNS)
        .single()
      if (error) throw error
      return data as NotificationSettings
    },

    async enqueueEmailDelivery(params: {
      notification_id: string
      user_id: string
      to_email: string | null
    }): Promise<void> {
      const { error } = await deliveryTable.insert({
        notification_id: params.notification_id,
        user_id: params.user_id,
        channel: 'email',
        status: 'pending',
        to_email: params.to_email,
      })
      if (error) throw error
    },

    async claimDueDeliveries(limit = 20): Promise<DeliveryRecord[]> {
      // Idle rows (pending/retry_wait) are always due when next_attempt_at has
      // elapsed. A `processing` row is also included once its lease has expired
      // (HOST-ASYNC-01): the worker that claimed it crashed before advancing,
      // so it must be recovered rather than stranded. `markProcessing` performs
      // the atomic re-claim against the same lease gate.
      const now = new Date()
      const staleProcessingSince = new Date(
        now.getTime() - PROCESSING_LEASE_MS,
      ).toISOString()
      const fields =
        'id,notification_id,user_id,channel,status,attempts,to_email,provider_message_id,last_error,next_attempt_at,created_at,updated_at'

      const idle = await deliveryTable
        .select(fields)
        .in('status', ['pending', 'retry_wait'])
        .lte('next_attempt_at', now.toISOString())
        .order('next_attempt_at', { ascending: true })
        .limit(limit)

      if (idle.error) throw idle.error

      const remaining = Math.max(0, limit - (idle.data?.length ?? 0))
      const stale: { data: DeliveryRecord[] | null; error: unknown } =
        remaining > 0
          ? await deliveryTable
              .select(fields)
              .eq('status', 'processing')
              .lt('updated_at', staleProcessingSince)
              .order('updated_at', { ascending: true })
              .limit(remaining)
          : { data: [], error: null }

      if (stale.error) throw stale.error
      return [...(idle.data ?? []), ...(stale.data ?? [])] as DeliveryRecord[]
    },

    async markProcessing(id: string): Promise<boolean> {
      // Optimistic gate: an idle (pending/retry_wait) row may be claimed with
      // an exclusive UPDATE; another worker claiming first gets 0 rows and
      // returns false. The claim writes `updated_at` as the lease heartbeat.
      const nowIso = new Date().toISOString()
      const idle = await deliveryTable
        .update({ status: 'processing', updated_at: nowIso })
        .in('status', ['pending', 'retry_wait'])
        .eq('id', id)
        .select('id')
        .single()
      if (idle.error) return false
      if (idle.data) return true

      // Idle claim lost: the row may be a `processing` claim abandoned by a
      // crashed worker (HOST-ASYNC-01). Re-claim it only once its lease has
      // expired. Again an exclusive UPDATE, so a concurrent worker running the
      // same recovery wins exactly once.
      const staleProcessingSince = new Date(
        Date.now() - PROCESSING_LEASE_MS,
      ).toISOString()
      const stale = await deliveryTable
        .update({ status: 'processing', updated_at: nowIso })
        .eq('status', 'processing')
        .lt('updated_at', staleProcessingSince)
        .eq('id', id)
        .select('id')
        .single()
      if (stale.error) return false
      return Boolean(stale.data)
    },

    async markSent(id: string, providerMessageId?: string): Promise<void> {
      const { error } = await deliveryTable
        .update({
          status: 'sent',
          provider_message_id: providerMessageId ?? null,
          last_error: null,
          next_attempt_at: undefined,
        })
        .eq('id', id)
      if (error) throw error
    },

    async markFailed(
      id: string,
      errorMessage: string,
      maxAttempts: number,
    ): Promise<void> {
      // Read current attempts to branch retry_wait vs failed.
      const { data, error } = await deliveryTable
        .select('attempts')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      const attempts = (data?.attempts ?? 0) + 1
      const next = attempts >= maxAttempts ? 'failed' : 'retry_wait'
      const backoffMs = Math.min(Math.pow(2, attempts) * 60_000, 3_600_000)
      const { error: updError } = await deliveryTable
        .update({
          status: next,
          attempts,
          last_error: errorMessage,
          next_attempt_at:
            next === 'failed'
              ? undefined
              : new Date(Date.now() + backoffMs).toISOString(),
        })
        .eq('id', id)
      if (updError) throw updError
    },

    async getNotificationById(id: string): Promise<Notification | null> {
      const { data, error } = await table
        .select(
          'id,user_id,type,entity_type,entity_id,title,body,read_at,dedupe_key,expires_at,created_at',
        )
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return (data as Notification | null) ?? null
    },

    async deleteExpiredNotifications(): Promise<number> {
      const { data, error } = await table
        .delete()
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date().toISOString())
        .select('id')
      if (error) throw error
      return data?.length ?? 0
    },
  }
}
