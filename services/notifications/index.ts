// src/services/notifications/index.ts
export {
  NotificationsService,
  getNotificationsService,
} from './notifications.service'
export {
  NOTIFICATION_ACTION_MAP,
  NOTIFICATION_ROUTES,
  buildActionableNotifications,
  loadNotificationDomainState,
  resolveNotificationAction,
  type ActionableNotification,
  type ActionableNotificationContext,
  type NotificationActor,
  type NotificationDomainState,
  type SafeActionKind,
} from './notification-actions'
export { createNotificationsRepository } from './notifications.repository'
export type {
  NotificationsRepository,
  CreateNotificationInput,
} from './notifications.repository'
export {
  CHANNEL_ELIGIBILITY,
  DEFAULT_CHANNEL_PREFS,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_SETTINGS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  type Notification,
  type NotificationChannel,
  type NotificationDigestCadence,
  type NotificationInsert,
  type NotificationPreference,
  type NotificationPreferenceInsert,
  type NotificationSettings,
  type NotificationType,
  type PreferenceMatrix,
} from './notifications.types'
