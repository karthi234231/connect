import {
  getUnreadNotificationCount,
  listActionableNotifications,
  markAllNotificationsRead as markAllReadAction,
  markNotificationAsReadAction,
  type ActionableNotificationItem,
} from '@/app/actions/notifications'

export type NotificationSummary = ActionableNotificationItem

export async function fetchNotifications(): Promise<
  ActionableNotificationItem[]
> {
  return listActionableNotifications()
}

export async function fetchUnreadCount(): Promise<number> {
  return getUnreadNotificationCount()
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await markNotificationAsReadAction(id)
}

export async function markAllNotificationsRead(): Promise<void> {
  await markAllReadAction()
}
