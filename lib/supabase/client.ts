// Browser client uses cookie storage (`@supabase/ssr` createBrowserClient)
// so the PKCE code-verifier cookie survives the LinkedIn round-trip and the
// /callback route can read it. A localStorage client would keep the verifier
// in a tab-local store the server never sees → exchange fails with
// "PKCE code verifier not found" and the user bounces to /login?next=….
// Singleton per tab: the verifier write and the redirect must share one store.
import { createBrowserClient } from '@supabase/ssr'
import { env } from '@/lib/env'
import type { Database } from '@/types/database'

export function createClientSupabaseClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

let clientSingleton: ReturnType<typeof createClientSupabaseClient> | null = null

export function getSupabaseClient() {
  if (typeof window === 'undefined') {
    return createClientSupabaseClient()
  }

  if (!clientSingleton) {
    clientSingleton = createClientSupabaseClient()
  }

  return clientSingleton
}
