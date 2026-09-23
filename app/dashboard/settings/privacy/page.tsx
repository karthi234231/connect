'use client'

import { useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  CardContent,
  Input,
  SectionHeading,
  StatusDot,
} from '@/components/ui'
import { SettingsGroup, SettingsRow } from '@/components/profile'
import { LoadingState } from '@/components/states/LoadingState'
import { useQuery } from '@/client/query/client'
import {
  fetchPrivacySettings,
  requestDataExport,
  requestErase,
  updatePrivacySettings,
  type PrivacyFlags,
} from '@/client/api/settings'

const rows: Array<{
  key: keyof PrivacyFlags
  label: string
  description: string
}> = [
  {
    key: 'public',
    label: 'Public profile',
    description: 'Allow people outside your network to find you.',
  },
  {
    key: 'status',
    label: 'Show online status',
    description: "Let others see when you're around.",
  },
  {
    key: 'requests',
    label: 'Allow message requests',
    description: 'Accept direct messages from new people.',
  },
]

const SETTINGS_QUERY_KEY = 'settings/privacy'

const ERASE_CONFIRMATION_WORD = 'ERASE'

export default function PrivacySettingsPage() {
  const { data, isLoading, refetch } = useQuery(SETTINGS_QUERY_KEY, () =>
    fetchPrivacySettings(),
  )
  const [flags, setFlags] = useState<PrivacyFlags>({
    public: true,
    status: true,
    requests: true,
  })
  const [storedFlags, setStoredFlags] = useState<PrivacyFlags | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [exportState, setExportState] = useState<
    'idle' | 'requesting' | 'done'
  >('idle')
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [eraseState, setEraseState] = useState<'idle' | 'requesting' | 'done'>(
    'idle',
  )
  const [eraseError, setEraseError] = useState<string | null>(null)
  const [eraseConfirm, setEraseConfirm] = useState('')

  // Server becomes authoritative once it responds: sync the optimistic state
  // to the persisted flags exactly when a fresh snapshot arrives.
  if (data?.flags && data.flags !== storedFlags) {
    setStoredFlags(data.flags)
    setFlags(data.flags)
    setSaveError(null)
  }

  async function toggle(key: keyof PrivacyFlags, checked: boolean) {
    const next = { ...flags, [key]: checked }
    setFlags(next)
    setSaveError(null)

    const result = await updatePrivacySettings(next)

    if (!result.ok) {
      setSaveError(result.error)
      setFlags((current) => ({ ...current, [key]: !checked }))
      void refetch()
    }
  }

  async function handleExport() {
    setExportState('requesting')
    setExportMessage(null)
    try {
      const result = await requestDataExport()
      setExportMessage(
        result.alreadyPending
          ? 'An export was already requested — it will arrive by email shortly.'
          : "Export requested. We'll email you a download link shortly.",
      )
      setExportState('done')
    } catch (cause) {
      setExportMessage('Could not start your export. Please try again.')
      setExportState('idle')
      console.error('Data export failed', cause)
    }
  }

  async function handleErase() {
    if (eraseConfirm.trim().toUpperCase() !== ERASE_CONFIRMATION_WORD) return
    setEraseState('requesting')
    setEraseError(null)
    try {
      await requestErase()
      setEraseState('done')
    } catch (cause) {
      setEraseError('Could not start the erasure request. Please try again.')
      setEraseState('idle')
      console.error('Data erasure failed', cause)
    }
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Settings"
          title="Privacy"
          description="Who sees what, and what you control."
        />

        {isLoading ? (
          <LoadingState />
        ) : (
          <>
            <SettingsGroup title="Privacy">
              <StatusDot
                className="px-3 pt-3"
                tone={flags.public ? 'success' : 'neutral'}
                label={
                  flags.public
                    ? 'Public profile is visible'
                    : 'Public profile is hidden'
                }
              />
              {rows.map((row) => (
                <SettingsRow
                  key={row.key}
                  title={row.label}
                  description={row.description}
                  toggle
                  variant="checkbox"
                  checked={flags[row.key]}
                  onCheckedChange={(checked) => void toggle(row.key, checked)}
                />
              ))}
            </SettingsGroup>
            {saveError && (
              <p className="mt-3 text-xs leading-5 text-[var(--cx-danger)]">
                {saveError}
              </p>
            )}

            <Card className="mt-3">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--cx-surface-2)] text-[var(--cx-brand-strong)]">
                    <Download className="size-4" />
                  </div>
                  <div className="flex-1">
                    <SectionHeading title="Data export" />
                    <p className="mt-0.5 text-sm leading-5 text-[var(--cx-text-3)]">
                      Get a copy of your activities, ideas, and profile data.
                    </p>
                    <Button
                      variant="secondary"
                      className="mt-4"
                      disabled={exportState === 'requesting'}
                      onClick={() => void handleExport()}
                    >
                      {exportState === 'requesting'
                        ? 'Requesting…'
                        : 'Request export'}
                    </Button>
                    {exportMessage && (
                      <p className="mt-2.5 text-xs leading-5 text-[var(--cx-text-3)]">
                        {exportMessage}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-3 border-[var(--cx-danger)]/40">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--cx-danger-soft)] text-[var(--cx-danger)]">
                    <Trash2 className="size-4" />
                  </div>
                  <div className="flex-1">
                    <SectionHeading title="Erase my data" />
                    <p className="mt-0.5 text-sm leading-5 text-[var(--cx-text-3)]">
                      Irreversibly delete your profile and data within 30 days.
                      Type <span className="font-mono text-xs">ERASE</span> to
                      confirm.
                    </p>
                    {eraseState === 'done' ? (
                      <p className="mt-4 text-xs leading-5 text-[var(--cx-success)]">
                        Erasure requested. We'll confirm once it completes.
                      </p>
                    ) : (
                      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                        <Input
                          value={eraseConfirm}
                          onChange={(event) =>
                            setEraseConfirm(event.target.value)
                          }
                          placeholder="ERASE"
                          className="max-w-[180px] font-mono"
                        />
                        <Button
                          variant="danger"
                          disabled={
                            eraseState === 'requesting' ||
                            eraseConfirm.trim().toUpperCase() !==
                              ERASE_CONFIRMATION_WORD
                          }
                          onClick={() => void handleErase()}
                        >
                          {eraseState === 'requesting'
                            ? 'Requesting…'
                            : 'Confirm erasure'}
                        </Button>
                      </div>
                    )}
                    {eraseError && (
                      <p className="mt-2.5 text-xs leading-5 text-[var(--cx-danger)]">
                        {eraseError}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
