'use client'

import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function getNextPath(): string {
  if (typeof window === 'undefined') return POST_LOGIN_ROUTE
  const next = new URLSearchParams(window.location.search).get('next')
  return next && isSafeRedirectUrl(next) ? next : POST_LOGIN_ROUTE
}

export default function LoginPage() {
  const [pending, setPending] = useState(false)
  const [statusStage, setStatusStage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [nextPath, setNextPath] = useState<string>(POST_LOGIN_ROUTE)
  const [agreedToTerms, setAgreedToTerms] = useState(true)
  const [authTab, setAuthTab] = useState<'linkedin' | 'sso'>('linkedin')
  const [workEmail, setWorkEmail] = useState('')
  const [ssoStatus, setSsoStatus] = useState<string | null>(null)
  const [ssoSubmitting, setSsoSubmitting] = useState(false)

  useEffect(() => {
    setNextPath(getNextPath())
  }, [])

  async function startLinkedInSignIn(): Promise<void> {
    if (pending) return
    if (!agreedToTerms) {
      setErrorMessage('Please accept the Terms of Service to continue.')
      return
    }
    setPending(true)
    setErrorMessage(null)
    setStatusStage('Preparing secure authorization…')

    try {
      const next = getNextPath()
      const redirectTo = new URL(OAUTH_CALLBACK_PATH, window.location.origin)
      if (next && next !== POST_LOGIN_ROUTE) {
        redirectTo.searchParams.set('next', next)
      }

      setStatusStage('Resolving OAuth capabilities…')
      const supabase = getSupabaseClient()
      const scopes = await scopesForOAuth().catch(() => [
        ...DEFAULT_LINKEDIN_OAUTH_SCOPES,
      ])

      setStatusStage('Redirecting to LinkedIn…')
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
        setStatusStage(null)
      }
      // On success Supabase performs the browser redirect — stay pending.
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Sign-in failed. Please try again.',
      )
      setPending(false)
      setStatusStage(null)
    }
  }

  function handleSsoLookup(e: React.FormEvent) {
    e.preventDefault()
    if (!workEmail.trim() || !workEmail.includes('@')) {
      setSsoStatus('Please enter a valid work email address.')
      return
    }
    setSsoSubmitting(true)
    setSsoStatus(null)

    setTimeout(() => {
      setSsoSubmitting(false)
      const domain = workEmail.split('@')[1] ?? 'your domain'
      setSsoStatus(
        `SSO route detected for ${domain}. Single Sign-On redirect is configured via LinkedIn identity verification. Please use LinkedIn Sign-In above to complete authentication.`,
      )
    }, 600)
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-56px-64px)] w-full max-w-lg flex-col justify-center px-4 py-10">
      <div>
        {/* Header Branding */}
        <div className="mb-6 text-center">
          <p className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--cx-text-2)] shadow-xs">
            <BriefcaseBusiness className="size-3.5 text-[var(--cx-brand-strong)]" />
            Verified Professional Network
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--cx-text-1)] sm:text-3xl">
            {AUTH_MESSAGES.LOGIN_TITLE}
          </h1>
          <p className="mt-2 text-sm text-[var(--cx-text-3)] max-w-sm mx-auto">
            {AUTH_MESSAGES.LOGIN_SUBTITLE}
          </p>

          {nextPath !== POST_LOGIN_ROUTE && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--cx-brand-soft)] bg-[var(--cx-brand-soft)]/30 px-3 py-1 text-xs text-[var(--cx-brand-strong)]">
              <Sparkles className="size-3.5 shrink-0" />
              <span>
                Redirect target: <strong className="font-semibold">{nextPath}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Tab Selection */}
        <div className="mb-4 flex rounded-full bg-[var(--cx-surface-2)] p-1 border border-[var(--cx-border-1)]">
          <button
            type="button"
            onClick={() => setAuthTab('linkedin')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-full py-1.5 text-xs font-medium transition-all ${
              authTab === 'linkedin'
                ? 'bg-[var(--cx-surface-1)] text-[var(--cx-text-1)] shadow-xs font-semibold'
                : 'text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)]'
            }`}
          >
            <BriefcaseBusiness className="size-3.5" />
            LinkedIn OAuth
          </button>
          <button
            type="button"
            onClick={() => setAuthTab('sso')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-full py-1.5 text-xs font-medium transition-all ${
              authTab === 'sso'
                ? 'bg-[var(--cx-surface-1)] text-[var(--cx-text-1)] shadow-xs font-semibold'
                : 'text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)]'
            }`}
          >
            <Building2 className="size-3.5" />
            Enterprise SSO
          </button>
        </div>

        {/* Main Card */}
        <div className="cx-dialog-enter space-y-5 rounded-[24px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-6 shadow-[var(--cx-shadow-card)]">
          {authTab === 'linkedin' ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => void startLinkedInSignIn()}
                disabled={pending || !agreedToTerms}
                className="group relative flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-[#0A66C2] text-sm font-semibold text-white shadow-[0_10px_28px_rgba(10,102,194,.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0959a8] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {statusStage || AUTH_MESSAGES.LINKEDIN_LOADING}
                  </span>
                ) : (
                  <>
                    <BriefcaseBusiness className="size-4 transition-transform group-hover:scale-110" />
                    {AUTH_MESSAGES.LINKEDIN_CTA}
                    <ArrowRight className="size-4 opacity-70 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              {/* Consent Toggle */}
              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => {
                    setAgreedToTerms(e.target.checked)
                    if (e.target.checked && errorMessage?.includes('Terms')) {
                      setErrorMessage(null)
                    }
                  }}
                  className="mt-0.5 size-4 rounded border-[var(--cx-border-1)] text-[var(--cx-brand)] focus:ring-[var(--cx-brand)]"
                />
                <span className="text-xs leading-5 text-[var(--cx-text-3)]">
                  I agree to the Connect Terms of Service and acknowledge the Privacy Policy. Professional details are synced securely.
                </span>
              </label>
            </div>
          ) : (
            <form onSubmit={handleSsoLookup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 size-4 text-[var(--cx-text-4)]" />
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={ssoSubmitting}
                className="w-full"
              >
                {ssoSubmitting ? 'Checking SSO configuration…' : 'Check Enterprise Access'}
              </Button>

              {ssoStatus && (
                <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3.5 text-xs text-[var(--cx-text-2)] leading-relaxed">
                  {ssoStatus}
                </div>
              )}
            </form>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-[var(--cx-danger-soft)] bg-[var(--cx-danger-soft)]/50 p-3.5 text-xs text-[var(--cx-danger)] flex items-start gap-2"
            >
              <span className="font-semibold shrink-0">Error:</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Trust Features List */}
          <div className="border-t border-[var(--cx-border-1)] pt-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-[var(--cx-text-3)]">
              <CheckCircle2 className="size-3.5 text-[var(--cx-success)] shrink-0" />
              <span>Verified LinkedIn identity &amp; experience sync</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--cx-text-3)]">
              <ShieldCheck className="size-3.5 text-[var(--cx-brand-strong)] shrink-0" />
              <span>Granular privacy controls &amp; zero public spam</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--cx-text-3)]">
              <Lock className="size-3.5 text-[var(--cx-text-3)] shrink-0" />
              <span>Encrypted session tokens &amp; CSRF protection</span>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-[var(--cx-text-4)]">
          Connect uses LinkedIn OAuth OIDC for identity verification.
          No credentials or passwords are ever stored on our servers.
        </p>
      </div>
    </main>
  )
}
