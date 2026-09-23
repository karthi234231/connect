// Shared admin-console constants. Kept out of config/routes.ts (unowned);
// the two new admin paths below are the single source of truth for the
// console's card grid and sub-pages.

export const ADMIN_PATHS = {
  moderation: '/admin/moderation',
  users: '/admin/users',
  events: '/admin/events',
  audit: '/admin/audit',
} as const

export const ADMIN_QUERY_KEYS = {
  stats: 'admin:stats',
  health: 'admin:health',
  queue: (status: string) => `admin:queue:${status}`,
  users: 'admin:users',
  events: 'admin:events',
  audit: 'admin:audit',
} as const

export const ADMIN_PAGE_SIZES = {
  queue: 50,
  users: 50,
  events: 50,
  audit: 50,
} as const
