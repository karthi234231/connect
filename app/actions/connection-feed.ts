// src/app/actions/connection-feed.ts
// Connections feed read boundary: incoming + outgoing + accepted counterparts.
'use server'

import { requireUser } from '@/lib/auth'
import { getConnectionFeed } from '@/services/connections/connection.service'

export type ConnectionFeedResult = Awaited<ReturnType<typeof getConnectionFeed>>

export async function getConnectionFeedAction(): Promise<ConnectionFeedResult> {
  const userId = await requireUser()
  return getConnectionFeed(userId)
}
