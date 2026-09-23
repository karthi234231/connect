// src/app/(marketing)/page.tsx
// Marketing landing — the real root route. Entry flow: marketing (/) →
// login (/login) → LinkedIn OIDC → callback → authenticated app
// (/dashboard/discover via POST_LOGIN_ROUTE). Static content only — no demo
// data, no mock people/chats/events. Layout supplies Header + Footer.
import Link from 'next/link'
import {
  ArrowRight,
  CalendarCheck,
  MessageCircle,
  Sparkles,
  UserRoundSearch,
} from 'lucide-react'

import { Chip } from '@/components/ui'
import { ROUTES } from '@/config/routes'

const pillars = [
  {
    icon: UserRoundSearch,
    title: 'Discover aligned people',
    body: 'A swipe deck ranked by shared skills, intent and availability — every card is server-ranked, never a popularity contest.',
  },
  {
    icon: MessageCircle,
    title: 'Conversations worth making space for',
    body: 'Matches open private chat threads with context carried over from the profile you matched on.',
  },
  {
    icon: CalendarCheck,
    title: 'Meet at events',
    body: 'Host or join gatherings, see who is attending, and turn connections into face-to-face moments.',
  },
] as const

const steps = [
  {
    num: 1,
    title: 'Sign in with LinkedIn',
    body: 'One provider, verified identity. Your professional profile is provisioned in seconds — no password to remember.',
  },
  {
    num: 2,
    title: 'Shape your profile',
    body: 'What you offer, what you are looking for, and when you are available. Five short steps and your profile is live.',
  },
  {
    num: 3,
    title: 'Start discovering',
    body: 'Swipe through aligned profiles, match, and say hello. Deep-links you followed before signing in are honored.',
  },
] as const

export default function LandingPage() {
  return (
    <div className="space-y-16 py-6 sm:space-y-24">
      {/* Hero */}
      <section className="mx-auto max-w-[760px] text-center">
        <Chip active tabIndex={-1} className="pointer-events-none">
          <Sparkles className="size-3.5" aria-hidden /> Professional
          connections, minus the noise
        </Chip>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-[-.045em] sm:text-6xl">
          Meet the people
          <br />
          <span className="text-[var(--cx-brand-strong)]">
            worth building with
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-[560px] text-base leading-7 text-[var(--cx-text-2)]">
          Connect pairs founders, designers and engineers by shared skills and
          intent — then gets out of the way. No feeds to scroll, no followers to
          farm. Just aligned people and a reason to talk.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={ROUTES.login}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--cx-brand)] px-6 text-sm font-medium text-white shadow-[0_10px_28px_rgba(208,164,91,.25)] transition hover:-translate-y-0.5 hover:bg-[var(--cx-brand-strong)]"
          >
            Sign in with LinkedIn <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href={ROUTES.browse}
            className="inline-flex h-12 items-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-6 text-sm font-medium transition hover:bg-[var(--cx-surface-2)]"
          >
            Browse the community
          </Link>
        </div>
        <p className="mt-3 text-xs text-[var(--cx-text-3)]">
          Free to join · Verified identities · Your data stays yours
        </p>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-[1180px]">
        <div className="grid gap-4 sm:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-[24px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-6"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--cx-brand)] text-white">
                <Icon className="size-5" aria-hidden />
              </div>
              <h2 className="mt-4 font-display text-lg font-semibold tracking-[-.02em]">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--cx-text-2)]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[760px]">
        <h2 className="text-center font-display text-2xl font-semibold tracking-[-.03em] sm:text-3xl">
          How it works
        </h2>
        <ol className="mt-8 space-y-6">
          {steps.map(({ num, title, body }) => (
            <li key={num} className="flex gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] font-display text-sm font-semibold text-[var(--cx-brand-strong)]">
                {num}
              </span>
              <div>
                <h3 className="font-display text-base font-semibold tracking-[-.01em]">
                  {title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-[var(--cx-text-2)]">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-[760px] rounded-[28px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-8 text-center sm:p-12">
        <h2 className="font-display text-2xl font-semibold tracking-[-.03em] sm:text-3xl">
          Ready when you are
        </h2>
        <p className="mx-auto mt-3 max-w-[420px] text-sm leading-6 text-[var(--cx-text-2)]">
          Sign in once with LinkedIn and your first deck is waiting — ranked by
          what you build, offer and need.
        </p>
        <Link
          href={ROUTES.login}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--cx-brand)] px-6 text-sm font-medium text-white shadow-[0_10px_28px_rgba(208,164,91,.25)] transition hover:-translate-y-0.5 hover:bg-[var(--cx-brand-strong)]"
        >
          Sign in with LinkedIn <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>
    </div>
  )
}
