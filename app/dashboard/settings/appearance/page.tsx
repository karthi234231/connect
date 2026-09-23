'use client'

import { useEffect } from 'react'
import { useTheme } from '@teispace/next-themes'
import { PageHeader } from '@/components/layout/PageHeader'
import { RadioGroup, RadioGroupItem } from '@/components/ui'
import { SettingsGroup, SettingsRow } from '@/components/profile'
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion'
import { useLocalStorage } from '@/lib/hooks/useLocalStorage'

// Client-only appearance preferences. There is no server column for these yet
// (TODO migration), so the honest source of truth is the browser: persisted in
// localStorage, and `reduce motion` is seeded from the real OS preference
// rather than a hard-coded `false`.
const APPEARANCE_STORAGE_KEY = 'connect:appearance'

const rows = [
  {
    key: 'compact',
    label: 'Compact density',
    description: 'Reduce spacing and padding across cards.',
  },
  {
    key: 'motion',
    label: 'Reduce motion',
    description: 'Minimize animations across the app.',
  },
]

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme()
  const prefersReducedMotion = useReducedMotion()
  const [flags, setFlags] = useLocalStorage(APPEARANCE_STORAGE_KEY, {
    compact: false,
    motion: false,
  })

  // Seed the motion toggle from the OS setting the first time it is observed,
  // so the page reflects reality instead of a fabricated default.
  useEffect(() => {
    if (prefersReducedMotion && !flags.motion) {
      setFlags({ ...flags, motion: true })
    }
    // Only react to the OS value changing; flags are written by the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion])

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Settings"
          title="Appearance"
          description="How Connect looks and feels."
        />

        <SettingsGroup title="Density & motion">
          {rows.map((row) => (
            <SettingsRow
              key={row.key}
              title={row.label}
              description={row.description}
              toggle
              checked={flags[row.key as keyof typeof flags]}
              onCheckedChange={(checked) =>
                setFlags({ ...flags, [row.key]: checked })
              }
            />
          ))}
        </SettingsGroup>

        <SettingsGroup className="mt-3" title="Theme">
          <div className="p-3">
            <span className="block text-sm font-medium text-[var(--cx-text-1)]">
              Color theme
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-[var(--cx-text-3)]">
              Light, dark, or match your system.
            </span>
            <RadioGroup
              className="mt-3"
              value={theme ?? 'dark'}
              onValueChange={setTheme}
            >
              <RadioGroupItem value="dark" label="Dark" />
              <RadioGroupItem value="light" label="Light" />
              <RadioGroupItem value="system" label="System" />
            </RadioGroup>
          </div>
        </SettingsGroup>

        <p className="mt-3 text-xs leading-5 text-[var(--cx-text-3)]">
          Connect is dark-first by default. Switch to light or match your system
          here; density and motion prefs are saved in your browser.
        </p>
      </div>
    </div>
  )
}
