import type { Tables } from '@/types/database'

export type MatchRow = Tables<'matches'>
export type MatchStatus = MatchRow['status']

export interface MatchSummary {
  id: string
  otherUserId: string
  score: number | null
  status: MatchStatus
  createdAt: string
  lastMessageAt: string | null
  lastMessageContent: string | null
  unread: number
}

export interface MatchCardData {
  id: string
  otherUserId: string
  score: number | null
  sharedTag?: string
}
