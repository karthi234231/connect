import type { Tables } from '@/types/database'

export type ProfileRow = Tables<'profiles'>

export interface SessionUser {
  id: string
  email?: string
}

export type AuthStatus = 'idle' | 'authenticated' | 'guest'

export interface AuthSession {
  user: SessionUser | null
  status: AuthStatus
}
