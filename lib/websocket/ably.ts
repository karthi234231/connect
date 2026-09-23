import Ably from 'ably'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canMessageMatch } from '@/services/chat/access'

export function getAblyServerClient(): Ably.Rest {
  if (!env.ABLY_API_KEY) {
    throw new AppError(ErrorCodes.INTERNAL, 'ABLY_API_KEY is not configured')
  }

  return new Ably.Rest(env.ABLY_API_KEY)
}

export async function getAblyToken(
  matchId: string,
  userId: string,
): Promise<{
  token: string
  clientId: string
}> {
  const supabase = await createServerSupabaseClient()

  const { data: match, error } = await supabase
    .from('matches')
    .select('user1_id, user2_id, status')
    .eq('id', matchId)
    .single()

  if (error || !match) {
    logger.error('Match not found for Ably token', {
      matchId,
      userId,
      error: error?.message,
    })

    throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found')
  }

  const isParticipant = match.user1_id === userId || match.user2_id === userId

  if (!isParticipant) {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      'You are not a participant in this match',
    )
  }

  // Realtime must be exactly as strict as message authorization (#52):
  // canMessageMatch = active only. A pending match gets no channel token,
  // so realtime can never be used to reach a thread that rejects sends.
  if (!canMessageMatch(match)) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Match is not active')
  }

  const client = getAblyServerClient()

  const channelName = `match:${matchId}`

  try {
    const tokenDetails = await client.auth.requestToken({
      clientId: userId,
      capability: JSON.stringify({
        [channelName]: ['publish', 'subscribe', 'presence'],
      }),
      ttl: 60 * 1000,
    })

    logger.debug('Ably token generated', {
      matchId,
      userId,
      expires: tokenDetails.expires,
    })

    return {
      token: tokenDetails.token,
      clientId: userId,
    }
  } catch (error: unknown) {
    logger.error('Failed to generate Ably token', {
      matchId,
      userId,
      error,
    })

    throw new AppError(
      ErrorCodes.EXTERNAL_SERVICE,
      'Failed to generate token',
      {
        cause: error,
      },
    )
  }
}

export type AblyChannel = Ably.RealtimeChannel
