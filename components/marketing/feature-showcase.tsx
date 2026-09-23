'use client'

import { useState } from 'react'
import {
  UserRoundSearch,
  MessageSquare,
  CalendarCheck,
  Lightbulb,
  CheckCircle2,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { Card, Badge } from '@/components/ui'

const FEATURES = [
  {
    id: 'deck',
    label: 'Discovery Deck',
    icon: UserRoundSearch,
    headline: 'Ranked recommendations, zero algorithmic feeds',
    description:
      'Every card is calculated server-side based on explicit skill complementarity, geographic proximity, and current project intent.',
    metrics: ['Server-derived match scores', 'Zero follower metrics', 'Double-opt-in matching'],
  },
  {
    id: 'chat',
    label: 'Realtime Chat',
    icon: MessageSquare,
    headline: 'Private threads with context carried over',
    description:
      'WebSocket powered by Ably with exponential retry resilience, typing signals, read status updates, and media attachments.',
    metrics: ['Instant WebSocket sync', 'Attachment previews', 'Typing feedback'],
  },
  {
    id: 'events',
    label: 'Hosted Events',
    icon: CalendarCheck,
    headline: 'Turn digital alignment into face-to-face moments',
    description:
      'Host or RSVP to high-caliber community gatherings, tech breakfasts, and hackathons with verified attendee lists.',
    metrics: ['Verified attendee list', 'One-click RSVP', 'Calendar integration'],
  },
  {
    id: 'ideas',
    label: 'Idea Hub',
    icon: Lightbulb,
    headline: 'Find technical co-founders for ambitious projects',
    description:
      'Publish early concept briefs, receive collaboration requests, and form balanced builder teams in hours.',
    metrics: ['Project briefs', 'Role requirements', 'Team application workflow'],
  },
] as const

export function FeatureShowcase() {
  const [activeTab, setActiveTab] = useState<typeof FEATURES[number]['id']>('deck')

  const feature = FEATURES.find((f) => f.id === activeTab) ?? FEATURES[0]
  const FeatureIcon = feature.icon

  return (
    <div className="w-full">
      {/* Tab Selectors */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {FEATURES.map((f) => {
          const Icon = f.icon
          const isActive = f.id === activeTab
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveTab(f.id)}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--cx-brand)] text-white shadow-lg shadow-[var(--cx-brand)]/20 scale-[1.02]'
                  : 'border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]'
              }`}
            >
              <Icon className="size-4" />
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Active Tab Preview Card */}
      <Card
        glass
        className="mt-8 rounded-[28px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-6 sm:p-10 cx-fade-in"
      >
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <Badge variant="brand" className="mb-3 gap-1.5 font-mono text-xs uppercase">
              <Zap className="size-3" /> Enterprise Feature
            </Badge>
            <h3 className="font-display text-2xl font-bold tracking-tight text-[var(--cx-text-1)] sm:text-3xl">
              {feature.headline}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--cx-text-2)] sm:text-base">
              {feature.description}
            </p>

            <ul className="mt-6 space-y-2.5">
              {feature.metrics.map((m) => (
                <li key={m} className="flex items-center gap-2.5 text-xs font-medium text-[var(--cx-text-1)]">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-6 text-center shadow-inner">
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[var(--cx-brand)]/10 text-[var(--cx-brand-strong)]">
                <FeatureIcon className="size-8" />
              </div>
              <h4 className="mt-4 font-display text-lg font-bold text-[var(--cx-text-1)]">
                {feature.label} Platform
              </h4>
              <p className="mt-1 text-xs text-[var(--cx-text-2)]">
                Built with strict enterprise authorization & zero data mining.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500">
                <ShieldCheck className="size-3.5" /> SOC-2 Ready Protocol
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
