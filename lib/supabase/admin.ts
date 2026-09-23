// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Admin Supabase client – uses service role key.
 * Bypasses RLS. Never use on the client.
 */
export function createAdminSupabaseClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

let adminSingleton: ReturnType<typeof createAdminSupabaseClient> | null = null

export function getAdminSupabaseClient() {
  if (typeof window !== 'undefined') {
    throw new Error('Admin Supabase client cannot be used in the browser.')
  }

  if (!adminSingleton) {
    adminSingleton = createAdminSupabaseClient()
  }

  return adminSingleton
}

/**
 * Fail-closed when the service-role key is absent: server-only code paths that
 * expect RLS bypass get an explicit null instead of a half-configured client.
 */
export function tryGetAdminSupabaseClient() {
  try {
    return getAdminSupabaseClient()
  } catch {
    return null
  }
}
