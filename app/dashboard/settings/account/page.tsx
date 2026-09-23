'use client'

import { useState } from 'react'
import { AlertTriangle, BriefcaseBusiness, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/states/LoadingState'
import { Button, Card, CardContent, Input } from '@/components/ui'
import { SettingsGroup } from '@/components/profile'
import { useQuery } from '@/client/query/client'
import { deactivateAccount, fetchAccountSettings } from '@/client/api/settings'
import {
  disconnectLinkedIn,
  messageFrom,
  resyncLinkedIn,
} from '@/client/api/linkedin'
import { showErrorToast, showSuccessToast } from '@/lib/toast'

const ACCOUNT_QUERY_KEY = 'settings/account'

/**
 * Account settings. Identity (name + email) is PROVIDER-OWNED (LinkedIn OIDC)
 * and read-only here — P0-10: the page no longer shows a save button that
 * cannot persist, and the email is read from auth (the only source that has it).
 */
export default function AccountSettingsPage() {
  const { data: account, isLoading } = useQuery(ACCOUNT_QUERY_KEY, () =>
    fetchAccountSettings(),
  )

  const [deactivateConfirm, setDeactivateConfirm] = useState(false)
  const [deactivateState, setDeactivateState] = useState<
    'idle' | 'deactivating' | 'done' | 'error'
  >('idle')

  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [disconnectConfirm, setDisconnectConfirm] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectDone, setDisconnectDone] = useState(false)

  async function handleDeactivate() {
    setDeactivateState('deactivating')
    const result = await deactivateAccount()
    setDeactivateState(result.ok ? 'done' : 'error')
  }

  async function handleResync() {
    if (syncing) return
    setSyncing(true)
    setSyncError(null)
    try {
      await resyncLinkedIn()
      showSuccessToast(
        'LinkedIn sync complete',
        'Your name, headline, location and professional history were refreshed.',
      )
    } catch (err) {
      const detail = messageFrom(err)
      setSyncError(detail)
      showErrorToast('LinkedIn sync failed', detail)
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    if (disconnecting) return
    setDisconnecting(true)
    try {
      await disconnectLinkedIn()
      setDisconnectDone(true)
      setDisconnectConfirm(false)
      showSuccessToast(
        'LinkedIn disconnected',
        'Your LinkedIn profile data was cleared. Your account stays active — reconnect any time by signing in with LinkedIn.',
      )
    } catch (err) {
      const detail = messageFrom(err)
      showErrorToast('Could not disconnect LinkedIn', detail)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Settings"
          title="Account"
          description="The details tied to your sign-in."
        />

        <SettingsGroup title="Sign-in identity">
          {isLoading ? (
            <div className="p-3">
              <LoadingState label="Loading account…" />
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                  Name
                </span>
                <Input value={account?.name ?? ''} readOnly />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                  Email
                </span>
                <Input
                  value={account?.email ?? ''}
                  readOnly
                  placeholder="Managed by your sign-in provider"
                />
              </label>
              <p className="text-xs leading-5 text-[var(--cx-text-3)]">
                Your name and email are provided by LinkedIn and cannot be
                edited here.
              </p>
            </div>
          )}
        </SettingsGroup>

        <Card className="mt-3">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]">
                <BriefcaseBusiness className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">LinkedIn</p>
                <p className="mt-0.5 text-xs leading-5 text-[var(--cx-text-3)]">
                  Your professional profile comes from LinkedIn. Re-syncing
                  refreshes your name, headline, location, and imported
                  experience and education.
                </p>

                {syncError ? (
                  <p
                    role="alert"
                    className="mt-3 text-xs text-[var(--cx-danger)]"
                  >
                    {syncError}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<RefreshCw className="size-3.5" />}
                    disabled={syncing || disconnecting}
                    onClick={() => void handleResync()}
                  >
                    {syncing ? 'Syncing…' : 'Re-sync LinkedIn'}
                  </Button>

                  {disconnectConfirm ? (
                    <>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={disconnecting}
                        onClick={() => void handleDisconnect()}
                      >
                        {disconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDisconnectConfirm(false)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[var(--cx-danger)]"
                      disabled={disconnecting || syncing}
                      onClick={() => setDisconnectConfirm(true)}
                    >
                      Disconnect LinkedIn
                    </Button>
                  )}
                </div>

                {disconnectDone ? (
                  <p className="mt-3 text-xs leading-5 text-[var(--cx-success)]">
                    LinkedIn is disconnected. Your profile, experience and
                    education imported from LinkedIn were removed; the rest of
                    your account is untouched.
                  </p>
                ) : (
                  <p className="mt-3 text-xs leading-5 text-[var(--cx-text-4)]">
                    Disconnecting clears the LinkedIn identity we store (GDPR)
                    and removes provider-sourced profile data. You can connect
                    again by signing in with LinkedIn.
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
                <AlertTriangle className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Make profile private</p>
                {/* P0-10 / P0-18: honest copy. This makes the profile private
                    (visibility=private) — it is not an irreversible deletion. */}
                <p className="mt-0.5 text-sm leading-5 text-[var(--cx-text-3)]">
                  Your profile is hidden from Discover and search while private.
                  You can make it public again any time.
                </p>
                {deactivateState === 'done' ? (
                  <p className="mt-4 text-xs leading-5 text-[var(--cx-success)]">
                    Done — your profile is now private.
                  </p>
                ) : deactivateConfirm ? (
                  <div className="mt-4 flex items-center gap-2.5">
                    <Button
                      variant="danger"
                      disabled={deactivateState === 'deactivating'}
                      onClick={() => void handleDeactivate()}
                    >
                      {deactivateState === 'deactivating'
                        ? 'Updating…'
                        : 'Yes, make private'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setDeactivateConfirm(false)}
                    >
                      Cancel
                    </Button>
                    {deactivateState === 'error' && (
                      <span className="text-xs text-[var(--cx-danger)]">
                        That didn&apos;t work. Try again.
                      </span>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="danger"
                    className="mt-4"
                    onClick={() => setDeactivateConfirm(true)}
                  >
                    Make profile private
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
