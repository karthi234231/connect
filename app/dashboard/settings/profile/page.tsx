'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/states/LoadingState'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Input,
  Textarea,
} from '@/components/ui'
import { useQuery } from '@/client/query/client'
import { fetchOwnProfile } from '@/client/api/profiles'
import { updateIntroductionAction } from '@/app/actions/profiles'

const PROFILE_SETTINGS_QUERY_KEY = 'settings/profile'

export default function ProfileSettingsPage() {
  const { data: profile, isLoading } = useQuery(
    PROFILE_SETTINGS_QUERY_KEY,
    () => fetchOwnProfile(),
  )
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')

  // Prefill from the real profile once (no hard-coded "Alex Laurent"): the
  // introduction section (headline + bio) round-trips exactly.
  if (profile && profile.id !== loadedProfileId) {
    setLoadedProfileId(profile.id)
    setHeadline(profile.headline ?? '')
    setBio(profile.bio ?? '')
  }

  async function handleSave() {
    setSaveState('saving')
    // The introduction section (headline + bio) is the user-owned surface —
    // persisted through the validated server action, never a provider key.
    const result = await updateIntroductionAction({
      headline: headline.trim() === '' ? null : headline,
      bio: bio.trim() === '' ? null : bio,
    })
    setSaveState(result.ok ? 'saved' : 'error')
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Settings"
          title="Profile"
          description="The story you tell the network."
        />

        <Card>
          <CardContent className="space-y-4 p-5 sm:p-6">
            {isLoading ? (
              <LoadingState label="Loading profile…" />
            ) : (
              <>
                {/* Name is a provider-owned identity key (LinkedIn OIDC) with no
                    user-writable column — read-only display of the real value. */}
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                    Name
                  </span>
                  <Input value={profile?.full_name ?? ''} readOnly />
                </label>
                {/* Headline is user-owned (introduction section) — editable and
                    persisted via updateIntroductionAction. */}
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                    Headline
                  </span>
                  <Input
                    value={headline}
                    onChange={(event) => setHeadline(event.target.value)}
                    placeholder="A short line about what you do"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                    Bio
                  </span>
                  <Textarea
                    rows={4}
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                  />
                </label>
              </>
            )}
          </CardContent>
          <CardFooter className="justify-end gap-2 border-t border-[var(--cx-border-1)] p-5">
            {saveState === 'saved' ? (
              <span className="mr-auto text-xs text-[var(--cx-success)]">
                Saved.
              </span>
            ) : saveState === 'error' ? (
              <span className="mr-auto text-xs text-[var(--cx-danger)]">
                That didn&apos;t save. Please try again.
              </span>
            ) : null}
            <Link href="/dashboard/profile">
              <Button variant="ghost">Back to profile</Button>
            </Link>
            <Button
              disabled={saveState === 'saving'}
              onClick={() => void handleSave()}
            >
              {saveState === 'saving' ? 'Saving…' : 'Save'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
