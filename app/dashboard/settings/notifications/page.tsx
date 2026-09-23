'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SettingsGroup, SettingsRow } from '@/components/profile'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { useQuery } from '@/client/query/client'
import {
  fetchNotificationSettings,
  updateNotificationSettings,
} from '@/client/api/settings'
import {
  NOTIFICATION_TOGGLE_DEFAULT_FLAGS,
  type NotificationToggleFlags,
  type NotificationToggleKey,
} from '@/app/dashboard/settings/notification-model'

const rows: Array<{
  key: NotificationToggleKey
  label: string
  description: string
}> = [
  {
    key: 'matches',
    label: 'New matches',
    description: 'When someone new aligns with you.',
  },
  {
    key: 'messages',
    label: 'New messages',
    description: 'When a conversation gets a reply.',
  },
  {
    key: 'reminders',
    label: 'Event reminders',
    description: "Before events you're hosting or attending.",
  },
  {
    key: 'updates',
    label: 'Product updates',
    description: "Occasional notes on what's new in Connect.",
  },
]

const SETTINGS_QUERY_KEY = 'settings/notifications'

export default function NotificationSettingsPage() {
  const { data, isLoading, error, refetch } = useQuery(SETTINGS_QUERY_KEY, () =>
    fetchNotificationSettings(),
  )
  const [flags, setFlags] = useState(NOTIFICATION_TOGGLE_DEFAULT_FLAGS)
  const [storedFlags, setStoredFlags] =
    useState<NotificationToggleFlags | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Server becomes authoritative once it responds: sync the optimistic state
  // to the persisted flags exactly when a fresh snapshot arrives.
  if (data?.flags && data.flags !== storedFlags) {
    setStoredFlags(data.flags)
    setFlags(data.flags)
    setSaveError(null)
  }

  async function toggle(key: NotificationToggleKey, checked: boolean) {
    const next = { ...flags, [key]: checked }
    setFlags(next)
    setSaveError(null)

    const result = await updateNotificationSettings(next)

    if (!result.ok) {
      setSaveError(result.error)
      setFlags((current) => ({ ...current, [key]: !checked }))
      void refetch()
    }
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Settings"
          title="Notifications"
          description="What you'd like to hear about."
        />

        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <>
            <SettingsGroup title="Notifications">
              {rows.map((row) => (
                <SettingsRow
                  key={row.key}
                  title={row.label}
                  description={row.description}
                  toggle
                  checked={flags[row.key]}
                  onCheckedChange={(checked) => void toggle(row.key, checked)}
                />
              ))}
            </SettingsGroup>
            {saveError && (
              <p className="mt-3 text-xs leading-5 text-[var(--cx-danger)]">
                {saveError}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
