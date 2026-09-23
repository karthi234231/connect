'use client'

import { ArrowRight, ShieldAlert } from 'lucide-react'

export default function SuspendedPage() {
  return (
    <main className="cx-page-enter flex min-h-svh w-full items-center justify-center bg-[var(--cx-bg)] px-4 py-10 text-[var(--cx-text-1)]">
      <div className="w-full max-w-md">
        <div className="rounded-[24px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-6 shadow-[var(--cx-shadow-card)] sm:p-8">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-[var(--cx-danger-soft)] text-[var(--cx-danger)]">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-semibold tracking-[-.03em]">
            Your account is suspended
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--cx-text-3)]">
            While your account is suspended you can&apos;t use Connect —
            swiping, messaging, events, and introductions are paused. This is
            usually temporary.
          </p>
          <div className="mt-5 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-4 text-xs leading-5 text-[var(--cx-text-3)]">
            <p className="font-medium text-[var(--cx-text-2)]">
              What happens next?
            </p>
            <p className="mt-1.5">
              If you believe this is a mistake, reply to the review email you
              received, or contact support with your account email and
              we&apos;ll take another look.
            </p>
          </div>
          {/* P0-17: the session is still active, so linking /login would bounce
              back to /dashboard. POST /logout is the canonical sign-out — it
              clears cookies and lands on /login for a clean re-auth. */}
          <form action="/logout" method="post" className="mt-6">
            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--cx-brand)] text-sm font-medium text-white shadow-[0_10px_28px_rgba(208,164,91,.22)] transition hover:-translate-y-0.5 hover:bg-[var(--cx-brand-strong)]"
            >
              Sign out and back to login <ArrowRight className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
