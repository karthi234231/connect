// src/services/notifications/notifications.types.ts
import type { Database } from '@/types/database'

export type NotificationType = Database['public']['Enums']['notification_type']

export type NotificationChannel =
  Database['public']['Enums']['notification_channel']

export type NotificationDigestCadence =
  Database['public']['Enums']['notification_digest_cadence']

export type Notification = Database['public']['Tables']['notifications']['Row']

export type NotificationInsert =
  Database['public']['Tables']['notifications']['Insert']

export type NotificationPreference =
  Database['public']['Tables']['notification_preferences']['Row']

export type NotificationPreferenceInsert =
  Database['public']['Tables']['notification_preferences']['Insert']

export type NotificationSettings =
  Database['public']['Tables']['notification_settings']['Row']

export const NOTIFICATION_TYPES: NotificationType[] = [
  'match_created',
  'intro_requested',
  'message_received',
  'event_reminder',
  'event_group_assigned',
  'event_waitlist_promoted',
]

export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  'in_app',
  'email',
  'push',
]

export const DEFAULT_NOTIFICATION_PREFS: Record<NotificationType, boolean> = {
  match_created: true,
  intro_requested: true,
  message_received: true,
  event_reminder: true,
  event_group_assigned: true,
  event_waitlist_promoted: true,
}

/**
 * Deterministic channel eligibility per notification type.
 * A channel is eligible for a type only if it is listed here; effective
 * delivery = eligibility AND the user's per-type channel flag (in_app right).
 */
export const CHANNEL_ELIGIBILITY: Record<
  NotificationType,
  NotificationChannel[]
> = {
  match_created: ['in_app', 'email', 'push'],
  intro_requested: ['in_app', 'email', 'push'],
  message_received: ['in_app', 'email', 'push'],
  event_reminder: ['in_app', 'email', 'push'],
  event_group_assigned: ['in_app', 'email'],
  event_waitlist_promoted: ['in_app', 'email', 'push'],
}

/** Per-type master channel defaults (what a new preference row gets). */
export const DEFAULT_CHANNEL_PREFS: Record<
  NotificationType,
  Record<NotificationChannel, boolean>
> = {
  match_created: { in_app: true, email: true, push: true },
  intro_requested: { in_app: true, email: true, push: true },
  message_received: { in_app: true, email: true, push: true },
  event_reminder: { in_app: true, email: true, push: true },
  event_group_assigned: { in_app: true, email: true, push: false },
  event_waitlist_promoted: { in_app: true, email: true, push: true },
}

export interface PreferenceMatrix {
  enabled: boolean
  channels: Record<NotificationChannel, boolean>
}

export const DEFAULT_SETTINGS: NotificationSettings = {
  user_id: '',
  updated_at: '',
  quiet_hours_enabled: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
  quiet_hours_timezone: 'UTC',
  digest_cadence: 'never',
  digest_hour: 9,
  digest_timezone: 'UTC',
  security_alerts: true,
}
