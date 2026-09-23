// src/app/logout/route.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'

/**
 * Canonical logout authority (S01 TODO-C). Every logout affordance in the app
 * POSTs here — client-side signOut calls are forbidden so cookie clearing,
 * logging, and destination stay consistent. Always redirects to /login, even
 * on error (a failed server sign-out must never strand the user).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      logger.error('Logout error', { error: error.message })
    } else {
      logger.info('User logged out successfully')
    }
  } catch (error: unknown) {
    logger.error('Logout exception', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
  // P0-16: never 500 on a missing/malformed NEXT_PUBLIC_APP_URL. The request
  // origin is the always-available fallback, so a failed sign-out still lands
  // the user on /login instead of an error page.
  return NextResponse.redirect(new URL('/login', request.url))
}
