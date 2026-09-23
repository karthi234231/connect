import type { ReactNode } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ROUTES } from '@/config/routes'

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-[var(--cx-surface-2)] px-1.5 py-0.5 text-xs text-[var(--cx-text-2)]">
      {children}
    </code>
  )
}

const sections: { title: string; body: ReactNode }[] = [
  {
    title: 'What you share',
    body: 'Connect uses the profile you create — your name, role, skills, availability, and the ideas you post — to match you with people who want to build together. You stay in control of what appears on your profile.',
  },
  {
    title: 'Who sees your activity',
    body: 'Your public profile, ideas, and event registrations are visible to other members. Messages and match notes are shared only with the people you connect with, never broadcast.',
  },
  {
    title: 'Where your data lives',
    body: "Your data is stored on our infrastructure and used to power matching, search, and event coordination. We don't sell personal data to third parties, and we minimize what we keep.",
  },
  {
    title: 'Deletion and your GDPR tools',
    body: (
      <>
        You can export a machine-readable copy of everything we hold about you
        at <Code>{ROUTES.api.gdprExport}</Code>, and permanently erase your
        account and data at <Code>{ROUTES.api.gdprErase}</Code>.
      </>
    ),
  },
  {
    title: 'Retention',
    body: 'We keep account data for as long as your account is active and delete what we no longer need. Erased accounts are purged from backups within a defined window.',
  },
  {
    title: 'Contact',
    body: "Questions about privacy or your data? Write to privacy@connect.example and we'll respond within 30 days.",
  },
]

export default function PrivacyPage() {
  return (
    <div className="cx-page-enter">
      <PageHeader
        title="Privacy"
        description="How Connect handles the data you share while using the network."
      />
      <div className="max-w-xl space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-lg font-semibold tracking-[-.02em]">
              {section.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--cx-text-3)]">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  )
}
