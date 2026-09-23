import type { MatchStatus } from '@/types/match'
import {
  dismissMatchAction,
  getMatchesAction,
  getSwipeQuotaAction,
} from '@/app/actions/matches'
import { getRelationshipStateAction } from '@/app/actions/relationship-momentum'
import { performSwipeAction } from '@/app/actions/swipe'

export type MatchesResult = Awaited<ReturnType<typeof getMatchesAction>>

export interface FetchMatchesOptions {
  status?: MatchStatus
}

export async function fetchMatches(
  options?: FetchMatchesOptions,
): Promise<MatchesResult> {
  return getMatchesAction(options?.status)
}

export async function performSwipe(
  candidateUserId: string,
  action: 'like' | 'pass',
  recommendationId: string,
  clientIntentId: string,
): Promise<Awaited<ReturnType<typeof performSwipeAction>>> {
  return performSwipeAction({
    candidateId: candidateUserId,
    action,
    recommendationId,
    clientIntentId,
  })
}

export async function fetchMatchCard(
  matchId: string,
): Promise<Awaited<ReturnType<typeof getRelationshipStateAction>> | null> {
  try {
    return await getRelationshipStateAction({ matchId })
  } catch {
    return null
  }
}

export type SwipeQuotaResult = Awaited<ReturnType<typeof getSwipeQuotaAction>>

export function fetchSwipeQuota(): Promise<SwipeQuotaResult> {
  return getSwipeQuotaAction()
}

export async function dismissMatch(matchId: string): Promise<void> {
  return dismissMatchAction({ matchId })
}
