'use client'

import { useState } from 'react'
import { BriefcaseBusiness } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { scopesForOAuth } from '@/app/actions/auth'
import {
  DEFAULT_LINKEDIN_OAUTH_SCOPES,
  LINKEDIN_OIDC_PROVIDER,
  OAUTH_CALLBACK_PATH,
} from '@/lib/oauth'
import { POST_LOGIN_ROUTE } from '@/lib/auth-redirect'
import { AUTH_MESSAGES } from '@/lib/messages'
import { isSafeRedirectUrl } from '@/lib/redirect'

function getNextPath(): string {
  if (typeof window === 'undefined') return POST_LOGIN_ROUTE
  const next = new URLSearchParams(window.location.search).get('next')
  return next && isSafeRedirectUrl(next) ? next : POST_LOGIN_ROUTE
}

export default function LoginPage() {
  const [pending, setPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function startLinkedInSignIn(): Promise<void> {
    if (pending) return
    setPending(true)
    setErrorMessage(null)
    try {
      const next = getNextPath()
      const redirectTo = new URL(OAUTH_CALLBACK_PATH, window.location.origin)
      if (next && next !== POST_LOGIN_ROUTE)
        redirectTo.searchParams.set('next', next)
      const supabase = getSupabaseClient()
      // Resolve the configured LinkedIn scopes server-side (env-driven,
      // identity-only by default). A transient server-action failure must never
      // block sign-in, so fall back to the identity default.
      const scopes = await scopesForOAuth().catch(() => [
        ...DEFAULT_LINKEDIN_OAUTH_SCOPES,
      ])
      const { error } = await supabase.auth.signInWithOAuth({
        provider: LINKEDIN_OIDC_PROVIDER,
        options: {
          redirectTo: redirectTo.toString(),
          skipBrowserRedirect: false,
          scopes: scopes.join(' '),
        },
      })
      if (error) {
        setErrorMessage(error.message)
        setPending(false)
      }
      // On success Supabase performs the browser redirect — stay pending.
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Sign-in failed.',
      )
      setPending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-56px-64px)] w-full max-w-md flex-col justify-center px-4 py-10">
      <div>
        <div className="mb-6 text-center">
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-3 py-1 text-[11px] font-medium text-[var(--cx-text-3)]">
            <BriefcaseBusiness className="size-3.5" /> Professional network
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {AUTH_MESSAGES.LOGIN_TITLE}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--cx-text-3)]">
            {AUTH_MESSAGES.LOGIN_SUBTITLE}
          </p>
        </div>

        <div className="cx-dialog-enter space-y-4 rounded-[24px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-6 shadow-[var(--cx-shadow-card)]">
          <button
            type="button"
            onClick={() => void startLinkedInSignIn()}
            disabled={pending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#0A66C2] text-sm font-medium text-white shadow-[0_10px_28px_rgba(10,102,194,.28)] transition hover:-translate-y-0.5 hover:bg-[#0959a8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <span className="flex items-center gap-2">
                {AUTH_MESSAGES.LINKEDIN_LOADING}
              </span>
            ) : (
              <>
                <BriefcaseBusiness className="size-4" />{' '}
                {AUTH_MESSAGES.LINKEDIN_CTA}
              </>
            )}
          </button>

          {errorMessage && (
            <p className="rounded-xl border border-[var(--cx-danger-soft)] bg-[var(--cx-danger-soft)] px-3 py-2.5 text-xs text-[var(--cx-danger)]">
              {errorMessage}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-[var(--cx-text-4)]">
          Your LinkedIn profile is used to verify your professional identity.
        </p>
      </div>
    </main>
  )
}
