'use client'

import { NotificationsPanel } from '@/components/notifications'

export default function NotificationsPage() {
  return (
    <NotificationsPanel
      variant="page"
      emptyTitle="Caught up"
      emptyDescription="Matches, messages, and event updates will land here."
    />
  )
}
