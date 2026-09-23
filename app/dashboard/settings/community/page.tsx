'use client'

import { PageHeader } from '@/components/layout/PageHeader'
import { RadioGroup, RadioGroupItem } from '@/components/ui'
import { SettingsGroup, SettingsRow } from '@/components/profile'
import { useLocalStorage } from '@/lib/hooks/useLocalStorage'

// No server column backs these community preferences yet (TODO migration), so
// the browser is the source of truth: persisted in localStorage rather than
// re-seeded to a hard-coded default on every mount.
const COMMUNITY_STORAGE_KEY = 'connect:community'

export default function CommunitySettingsPage() {
  const [flags, setFlags] = useLocalStorage(COMMUNITY_STORAGE_KEY, {
    badge: true,
    beta: false,
    locationVisibility: 'network',
  })

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Settings"
          title="Community"
          description="Your presence in the network."
        />

        <SettingsGroup title="Community preferences">
          <SettingsRow
            title="Show member badge"
            description="Display the Connect badge on your public profile."
            toggle
            checked={flags.badge}
            onCheckedChange={(checked) =>
              setFlags({ ...flags, badge: checked })
            }
          />
          <SettingsRow
            title="Join beta program"
            description="Get early access to new formats and features."
            toggle
            checked={flags.beta}
            onCheckedChange={(checked) => setFlags({ ...flags, beta: checked })}
          />
        </SettingsGroup>

        <SettingsGroup className="mt-3" title="Location">
          <div className="p-3">
            <span className="block text-sm font-medium text-[var(--cx-text-1)]">
              Location visibility
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-[var(--cx-text-3)]">
              Who can see your city and region.
            </span>
            <RadioGroup
              className="mt-3"
              value={flags.locationVisibility}
              onValueChange={(value) =>
                setFlags({ ...flags, locationVisibility: value })
              }
            >
              <RadioGroupItem value="everyone" label="Everyone" />
              <RadioGroupItem value="network" label="Network" />
              <RadioGroupItem value="private" label="Private" />
            </RadioGroup>
          </div>
        </SettingsGroup>
      </div>
    </div>
  )
}
