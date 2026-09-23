// src/config/routes.ts
// Canonical route registry (P0-31). Every internal navigation target should be
// built from here so a route rename cannot leave a dead hard-coded href behind.
// Nested routes that take an id expose a builder; string keys remain for static
// paths and for backward compatibility with existing imports.
export const ROUTES = {
  home: '/',
  login: '/login',
  logout: '/logout',
  callback: '/callback',
  suspended: '/suspended',

  // Public
  browse: '/browse',
  publicEvents: '/events',
  publicEventSearch: '/events/search',
  privacy: '/privacy',
  terms: '/terms',

  // Dashboard
  dashboard: '/dashboard',
  discover: '/dashboard/discover',
  connections: '/dashboard/connections',
  matches: '/dashboard/matches',
  chat: '/dashboard/chat',
  notifications: '/dashboard/notifications',
  onboarding: '/dashboard/onboarding',

  profile: '/dashboard/profile',
  profileEdit: '/dashboard/profile/edit',
  profilePreview: '/dashboard/profile/preview',

  ideas: '/dashboard/ideas',
  ideasNew: '/dashboard/ideas/new',

  events: '/dashboard/events',
  eventsNew: '/dashboard/events/new',

  settings: '/dashboard/settings',
  settingsAccount: '/dashboard/settings/account',
  settingsAppearance: '/dashboard/settings/appearance',
  settingsCommunity: '/dashboard/settings/community',
  settingsNotifications: '/dashboard/settings/notifications',
  settingsPrivacy: '/dashboard/settings/privacy',
  settingsProfile: '/dashboard/settings/profile',
  settingsSecurity: '/dashboard/settings/security',
  /** Compatibility alias — prefer `settingsSecurity`. */
  security: '/settings/security',
  settingsBlocked: '/dashboard/settings/blocked',

  admin: '/admin',
  traction: '/traction',

  api: {
    browse: '/api/browse',
    search: '/api/search',
    health: '/api/health',
    eventsAnalytics: '/api/events/analytics',
    eventAnalyticsExport: '/api/events/[eventId]/analytics/export',
    eventAttendeesExport: '/api/events/[eventId]/attendees/export',
    gdprExport: '/api/gdpr/export',
    gdprErase: '/api/gdpr/erase',
    linkedinSync: '/api/linkedin/sync',
    linkedinDisconnect: '/api/linkedin/disconnect',
    queueWorker: '/api/queue/worker',
    notificationsPushSubscribe: '/api/notifications/push/subscribe',
  },
} as const

export type AppPath = (typeof ROUTES)[keyof Omit<typeof ROUTES, 'api'>]

// ─── Builders for nested routes ─────────────────────────────

export function chatThreadPath(matchId: string): string {
  return `${ROUTES.chat}/${matchId}`
}

export function ideaPath(ideaId: string): string {
  return `${ROUTES.ideas}/${ideaId}`
}

export function ideaEditPath(ideaId: string): string {
  return `${ROUTES.ideas}/${ideaId}/edit`
}

export function eventPath(eventId: string): string {
  return `${ROUTES.events}/${eventId}`
}

export function eventEditPath(eventId: string): string {
  return `${ROUTES.events}/${eventId}/edit`
}

export function eventAnalyticsPath(eventId: string): string {
  return `${ROUTES.events}/${eventId}/analytics`
}

export function eventAttendeesPath(eventId: string): string {
  return `${ROUTES.events}/${eventId}/attendees`
}

export function publicEventPath(eventId: string): string {
  return `${ROUTES.publicEvents}/${eventId}`
}

export function eventAnalyticsExportPath(eventId: string): string {
  return `/api/events/${eventId}/analytics/export`
}

export function eventAttendeesExportPath(eventId: string): string {
  return `/api/events/${eventId}/attendees/export`
}
