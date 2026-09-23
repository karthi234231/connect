import Link from 'next/link'
import {
  ArrowRight,
  Sparkles,
  Users,
  ShieldCheck,
  CheckCircle,
  Zap,
} from 'lucide-react'

import { Chip } from '@/components/ui'
import { ROUTES } from '@/config/routes'
import { InteractiveDemoDeck } from '@/components/marketing/interactive-demo'
import { FeatureShowcase } from '@/components/marketing/feature-showcase'

const metrics = [
  { label: 'Verified Builders', value: '12,500+' },
  { label: 'Match Satisfaction', value: '98.4%' },
  { label: 'Active Projects', value: '3,200+' },
  { label: 'Global Cities', value: '65+' },
] as const

const steps = [
  {
    num: '01',
    title: 'Authenticate via LinkedIn',
    body: 'Verified professional identity in seconds. No passwords or dummy profiles.',
  },
  {
    num: '02',
    title: 'Define Intent & Complementarity',
    body: 'Specify what you offer, what technical skills you seek, and your current availability.',
  },
  {
    num: '03',
    title: 'Engage Aligned Builders',
    body: 'Receive server-ranked candidate decks. Match, open WebSocket chat, and meet at events.',
  },
] as const

export default function LandingPage() {
  return (
    <div className="space-y-20 py-4 sm:space-y-28 sm:py-8">
      {/* Hero Section */}
      <section className="relative mx-auto max-w-[1180px]">
        {/* Subtle Ambient Radial Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[450px] w-[750px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-[var(--cx-brand)]/15 via-amber-500/10 to-transparent blur-3xl"
        />

        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Hero Left Column */}
          <div className="text-center lg:col-span-7 lg:text-left">
            <Chip active tabIndex={-1} className="pointer-events-none gap-1.5 shadow-sm">
              <Sparkles className="size-3.5 text-[var(--cx-brand-strong)]" aria-hidden />
              The Enterprise Builder Network
            </Chip>

            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.06] tracking-[-.045em] sm:text-6xl lg:text-6xl">
              Meet the people
              <br />
              <span className="bg-gradient-to-r from-[var(--cx-brand-strong)] via-amber-400 to-amber-600 bg-clip-text text-transparent">
                worth building with
              </span>
            </h1>

            <p className="mt-5 max-w-[580px] text-base leading-relaxed text-[var(--cx-text-2)] sm:text-lg">
              Connect pairs founders, engineers, and product designers by explicit skill alignment and availability. Zero social noise, zero algorithmic feeds—just verified builders and real outcomes.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5 lg:justify-start">
              <Link
                href={ROUTES.login}
                className="inline-flex h-13 items-center gap-2.5 rounded-full bg-gradient-to-r from-[var(--cx-brand)] to-[var(--cx-brand-strong)] px-7 text-sm font-semibold text-white shadow-xl shadow-[var(--cx-brand)]/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:brightness-110 active:scale-95"
              >
                Sign in with LinkedIn <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href={ROUTES.browse}
                className="inline-flex h-13 items-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-7 text-sm font-semibold text-[var(--cx-text-1)] shadow-sm transition-all duration-200 hover:bg-[var(--cx-surface-2)] active:scale-95"
              >
                Explore Community
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-[var(--cx-text-3)] lg:justify-start">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="size-4 text-emerald-500" /> SOC-2 Compliant
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle className="size-4 text-emerald-500" /> LinkedIn Verified
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Zap className="size-4 text-[var(--cx-brand-strong)]" /> Realtime WebSockets
              </span>
            </div>
          </div>

          {/* Hero Right Column: Interactive Demo Deck */}
          <div className="lg:col-span-5">
            <InteractiveDemoDeck />
          </div>
        </div>
      </section>

      {/* Live Metric Banner */}
      <section className="mx-auto max-w-[1180px] rounded-[24px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]/80 p-6 backdrop-blur-md">
        <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="space-y-1">
              <div className="font-display text-2xl font-bold tracking-tight text-[var(--cx-brand-strong)] sm:text-3xl">
                {m.value}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-3)]">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Showcase */}
      <section className="mx-auto max-w-[1180px]">
        <div className="mx-auto max-w-[600px] text-center mb-10">
          <Chip active tabIndex={-1} className="pointer-events-none mb-3">
            <Users className="size-3.5" /> Architected for Excellence
          </Chip>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--cx-text-1)] sm:text-4xl">
            Everything required to build together
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--cx-text-2)]">
            Explore the core architectural pillars powering the Connect platform.
          </p>
        </div>

        <FeatureShowcase />
      </section>

      {/* Workflow Section */}
      <section className="mx-auto max-w-[1180px]">
        <div className="mx-auto max-w-[600px] text-center mb-12">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--cx-text-1)] sm:text-4xl">
            How Connect works
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--cx-text-2)]">
            Three simple steps from authentication to active collaboration.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map(({ num, title, body }) => (
            <div
              key={num}
              className="relative rounded-[24px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--cx-brand)]/40 hover:shadow-xl"
            >
              <div className="font-mono text-2xl font-bold text-[var(--cx-brand-strong)]">
                {num}
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-[var(--cx-text-1)]">
                {title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--cx-text-2)]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative mx-auto max-w-[960px] overflow-hidden rounded-[32px] border border-[var(--cx-border-1)] bg-gradient-to-b from-[var(--cx-surface-1)] to-[var(--cx-surface-2)] p-10 text-center shadow-2xl sm:p-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 left-1/2 -z-10 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-[var(--cx-brand)]/20 blur-3xl"
        />

        <h2 className="font-display text-3xl font-bold tracking-tight text-[var(--cx-text-1)] sm:text-4xl">
          Ready to meet your next co-builder?
        </h2>
        <p className="mx-auto mt-4 max-w-[500px] text-sm leading-relaxed text-[var(--cx-text-2)] sm:text-base">
          Sign in once with LinkedIn. Your personalized recommendation deck is pre-calculated and waiting.
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            href={ROUTES.login}
            className="inline-flex h-13 items-center gap-2.5 rounded-full bg-gradient-to-r from-[var(--cx-brand)] to-[var(--cx-brand-strong)] px-8 text-sm font-semibold text-white shadow-xl shadow-[var(--cx-brand)]/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:brightness-110 active:scale-95"
          >
            Get Started with LinkedIn <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  )
}
