// src/lib/auth-redirect.ts
// Client-safe post-login landing contract (no server-only imports): the
// authenticated Discover swipe deck. proxy.ts / callback / login import the
// canonical POST_LOGIN_ROUTE from here instead of lib/oauth (which pulls the
// Supabase client types) so the Edge runtime never evaluates client code.
export const POST_LOGIN_ROUTE = '/dashboard/discover' as const
