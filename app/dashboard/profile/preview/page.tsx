'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { LoadingState } from '@/components/states/LoadingState'
import { Badge, Separator } from '@/components/ui'
import { ProfileHeader, ProfileSection } from '@/components/profile'
import { useQuery } from '@/client/query/client'
import { fetchOwnProfile } from '@/client/api/profiles'
import { getIntentLabel } from '@/services/profiles/intent'
import { formatLocation } from '@/utils/format-location'

const PREVIEW_QUERY_KEY = 'profile/preview'

export default function PreviewProfilePage() {
  const [previewKey] = useState(PREVIEW_QUERY_KEY)
  const { data: profile, isLoading } = useQuery(previewKey, () =>
    fetchOwnProfile(),
  )

  const headline = profile?.headline
    ? profile.headline
    : profile?.role
      ? (getIntentLabel(profile.role) ?? '')
      : ''

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[560px] px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/profile"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--cx-text-3)] transition hover:text-[var(--cx-text-1)]"
        >
          <ArrowLeft className="size-3.5" /> Back to profile
        </Link>

        {isLoading ? (
          <LoadingState label="Loading preview…" />
        ) : (
          <>
            <div className="mb-3">
              <Badge variant="outline">Preview</Badge>
            </div>
            <div className="space-y-3">
              <ProfileHeader
                name={profile?.full_name ?? 'Your profile'}
                headline={headline}
                location={
                  profile?.city
                    ? formatLocation(profile.city, '', '')
                    : undefined
                }
                bio={profile?.bio ?? undefined}
                avatarUrl={profile?.avatar_url ?? undefined}
              />
              <Separator />
              <ProfileSection title="Skills">
                {profile && profile.skills.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {profile.skills.map((skill) => (
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
          </>
        )}
      </div>
    </div>
  )
}
