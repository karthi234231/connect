// app/dashboard/settings/notification-model.ts
// Pure mapping between the Settings → Notifications page toggle keys and the
// notification_type enum values that actually have a persisted preference row.
// Client-safe (no server imports) so the page and the server action share one
// source of truth, and the mapping stays unit-testable.

export type NotificationToggleKey =
  'matches' | 'messages' | 'reminders' | 'updates'

export interface NotificationToggleFlags {
  matches: boolean
  messages: boolean
  reminders: boolean
  updates: boolean
}

/** Mirrors the settings page's original on-screen defaults. */
export const NOTIFICATION_TOGGLE_DEFAULT_FLAGS: NotificationToggleFlags = {
  matches: true,
  messages: true,
  reminders: true,
  updates: false,
}

/**
 * The persisted notification_type values reachable from the page toggles.
 * `updates` (Product updates) has NO notification_type enum value yet, so it is
 * deliberately absent — the toggle renders but is not persisted until the enum
 * grows a matching type (TODO).
 */
export type MappedNotificationType =
  'match_created' | 'message_received' | 'event_reminder'

export interface NotificationTogglePref {
  toggle: Exclude<NotificationToggleKey, 'updates'>
  /** The persisted notification_type for this toggle. */
  type: MappedNotificationType
}

export const NOTIFICATION_TOGGLE_PREFS: NotificationTogglePref[] = [
  { toggle: 'matches', type: 'match_created' },
  { toggle: 'messages', type: 'message_received' },
  { toggle: 'reminders', type: 'event_reminder' },
]

export interface NotificationPrefUpdate {
  type: MappedNotificationType
  enabled: boolean
}

/** Which preference rows a partial flag payload should actually write. */
export function notificationPrefUpdates(
  flags: Partial<NotificationToggleFlags>,
): NotificationPrefUpdate[] {
  const updates: NotificationPrefUpdate[] = []
  for (const { toggle, type } of NOTIFICATION_TOGGLE_PREFS) {
    const enabled = flags[toggle]
    if (typeof enabled !== 'boolean') continue
    updates.push({ type, enabled })
  }
  return updates
}

export interface StoredNotificationPref {
  type: string
  enabled: boolean
}

/**
 * Overlay stored preference rows onto the defaults so a page render reflects
 * what is actually persisted. Unknown/unmapped types are ignored (never
 * guessed), and `updates` stays at its default until it has a backend.
 */
export function resolveNotificationToggleFlags(
  stored: readonly StoredNotificationPref[],
  base: NotificationToggleFlags = NOTIFICATION_TOGGLE_DEFAULT_FLAGS,
): NotificationToggleFlags {
  const flags = { ...base }
  for (const pref of stored) {
    const mapping = NOTIFICATION_TOGGLE_PREFS.find(
      (entry) => entry.type === pref.type,
    )
    if (mapping) flags[mapping.toggle] = pref.enabled
  }
  return flags
}
