'use client'

import Link from 'next/link'
import {
  Bell,
  ChevronRight,
  Lock,
  Palette,
  ShieldBan,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui'
import { FeedbackForm } from '@/components/feedback/feedback-form'
import { ROUTES } from '@/config/routes'

// Route targets come from the canonical registry (config/routes.ts).
const sections = [
  {
    label: 'Account',
    description: 'Sign-in details and account actions.',
    icon: UserRound,
    href: ROUTES.settingsAccount,
  },
  {
    label: 'Blocked accounts',
    description: 'People you have blocked.',
    icon: ShieldBan,
    href: ROUTES.settingsBlocked,
  },
  {
    label: 'Appearance',
    description: 'Density, motion, and theme.',
    icon: Palette,
    href: ROUTES.settingsAppearance,
  },
  {
    label: 'Community',
    description: 'Your presence in the network.',
    icon: UsersRound,
    href: ROUTES.settingsCommunity,
  },
  {
    label: 'Notifications',
    description: 'What you hear about and how.',
    icon: Bell,
    href: ROUTES.settingsNotifications,
  },
  {
    label: 'Privacy',
    description: 'Who sees what, and data requests.',
    icon: Lock,
    href: ROUTES.settingsPrivacy,
  },
  {
    label: 'Profile',
    description: 'The story you tell the network.',
    icon: UserRound,
    href: ROUTES.settingsProfile,
  },
]

export default function SettingsPage() {
  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Settings"
          title="Settings"
          description="Account, look, and the details of your network."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map(({ label, description, icon: Icon, href }) => (
            <Link key={label} href={href} className="group">
              <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-[var(--cx-border-2)]">
                <CardContent className="p-0">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--cx-surface-2)] text-[var(--cx-brand-strong)]">
                    <Icon className="size-[18px]" />
                  </div>
                  <h2 className="mt-4 text-sm font-medium">{label}</h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--cx-text-3)]">
                    {description}
                  </p>
                  <span className="mt-4 flex items-center gap-1 text-[10px] font-medium text-[var(--cx-text-3)] group-hover:text-[var(--cx-brand-strong)]">
                    Open <ChevronRight className="size-3" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="mt-6">
          <CardContent className="p-5 sm:p-6">
            <p className="mb-1 text-sm font-medium">Send feedback</p>
            <p className="mb-4 text-xs leading-5 text-[var(--cx-text-3)]">
              Spotted a bug, miss something, or want a change? Tell us what
              would make Connect better for you.
            </p>
            <FeedbackForm context="/dashboard/settings" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
