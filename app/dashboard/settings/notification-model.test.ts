import { describe, expect, it } from 'vitest'

import {
  NOTIFICATION_TOGGLE_DEFAULT_FLAGS,
  notificationPrefUpdates,
  resolveNotificationToggleFlags,
} from './notification-model'

describe('notificationPrefUpdates', () => {
  it('maps only page toggles that have a persisted notification_type', () => {
    const updates = notificationPrefUpdates({
      matches: false,
      messages: true,
      reminders: true,
      updates: true,
    })

    // `updates` has no notification_type enum value — never emitted.
    expect(updates).toEqual([
      { type: 'match_created', enabled: false },
      { type: 'message_received', enabled: true },
      { type: 'event_reminder', enabled: true },
    ])
  })

  it('drops toggles the payload did not change', () => {
    expect(notificationPrefUpdates({})).toEqual([])
    expect(notificationPrefUpdates({ messages: true })).toEqual([
      { type: 'message_received', enabled: true },
    ])
  })
})

describe('resolveNotificationToggleFlags', () => {
  it('starts from defaults and overlays stored preferences', () => {
    const flags = resolveNotificationToggleFlags([
      { type: 'match_created', enabled: false },
      { type: 'event_reminder', enabled: false },
    ])

    expect(flags).toEqual({
      matches: false,
      messages: true,
      reminders: false,
      updates: false,
    })
  })

  it('ignores unknown types and keeps defaults', () => {
    const flags = resolveNotificationToggleFlags([
      { type: 'some_future_type', enabled: false },
    ])

    expect(flags).toEqual(NOTIFICATION_TOGGLE_DEFAULT_FLAGS)
  })
})
