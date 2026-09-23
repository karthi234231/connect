export const keys = {
  profile: (id: string) => ['profiles', id],
  browse: () => ['browse'],
  search: (query: string) => ['search', query],
  events: () => ['events'],
  event: (id: string) => ['events', id],
  eventAnalytics: (id: string) => ['events', id, 'analytics'],
  matches: () => ['matches'],
  match: (id: string) => ['matches', id],
  connections: () => ['connections'],
  threads: () => ['chat', 'threads'],
  messages: (matchId: string) => ['chat', 'messages', matchId],
  notifications: () => ['notifications'],
} as const

export type QueryKey = ReturnType<(typeof keys)[keyof typeof keys]>
