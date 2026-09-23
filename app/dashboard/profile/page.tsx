'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, Separator } from '@/components/ui'
import { ProfileHeader, ProfileSection } from '@/components/profile'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { formatLocation } from '@/utils/format-location'
import { getIntentLabel } from '@/services/profiles/intent'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { fetchOwnProfile } from '@/client/api/profiles'

export default function ProfilePage() {
  const [profileKey] = useState(() => keys.profile('me').join('/'))
  const { data, isLoading, error, refetch } = useQuery(profileKey, () =>
    fetchOwnProfile(),
  )

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Your profile"
          description="How the community sees you."
          actions={
            <>
              <Link href="/dashboard/profile/edit">
                <Button variant="ghost">Edit profile</Button>
              </Link>
              <Link href="/dashboard/profile/preview">
                <Button>Preview</Button>
              </Link>
            </>
          }
        />

        {isLoading ? (
          <LoadingState label="Loading profile…" />
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : !data ? (
          <ErrorState
            title="Profile not found"
            description="We couldn't load your profile."
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="mt-6 space-y-3">
            <ProfileHeader
              name={data.full_name ?? 'You'}
              headline={
                data.headline ||
                (data.role ? (getIntentLabel(data.role) ?? '') : '')
              }
              location={
                data.city ? formatLocation(data.city, '', '') : undefined
              }
              bio={data.bio ?? undefined}
              avatarUrl={data.avatar_url ?? undefined}
            />
            <Separator />
            <ProfileSection title="Skills">
              {data.skills.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {data.skills.map((skill) => (
                    <li
                      key={skill}
                      className="rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-2.5 py-1 text-[11px] text-[var(--cx-text-2)]"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[var(--cx-text-4)]">
                  No skills listed yet.
                </p>
              )}
            </ProfileSection>
          </div>
        )}
      </div>
    </div>
  )
}
