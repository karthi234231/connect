import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Briefcase, Calendar, MapPin, Sparkles, User } from 'lucide-react'
import { getPublicProfile } from '@/services/profiles/public-profile'
import { Badge, Button, Card, CardContent, CardTitle } from '@/components/ui'
import { SocialLinksBar, VCardExportButton } from '@/components/profile'

interface ProfilePageProps {
  params: Promise<{ userId: string }>
}

export async function generateMetadata({ params }: ProfilePageProps) {
  const { userId } = await params
  const profile = await getPublicProfile(userId, null)
  if (!profile) {
    return {
      title: 'Profile Not Found | Connect',
    }
  }

  const name = profile.identity.fullName || 'Community Member'
  return {
    title: `${name} | Connect Community Profile`,
    description: profile.bio || `${name}'s public profile on Connect.`,
  }
}

export default async function PublicProfilePage({ params }: ProfilePageProps) {
  const { userId } = await params
  const profile = await getPublicProfile(userId, null)

  if (!profile) {
    notFound()
  }

  const fullName = profile.identity.fullName || 'Community Member'
  const firstName = fullName.split(' ')[0] || 'Member'
  const avatarUrl = profile.identity.avatarUrl
  const profileId = profile.identity.id || userId

  return (
    <div className="relative min-h-screen bg-[#0A0C0F] px-4 py-8 text-[#F1EEE7] cx-page-enter">
      {/* Background Ambient Glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(208,164,91,0.1)_0%,transparent_70%)] blur-3xl"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 text-sm text-[var(--cx-text-3)] transition hover:text-[var(--cx-text-1)]"
        >
          <ArrowLeft className="size-4" /> Back to browse
        </Link>

        <Card className="overflow-hidden border border-[#293038] bg-[#101317]/90 backdrop-blur-xl shadow-2xl">
          <div className="h-32 bg-[linear-gradient(120deg,var(--cx-brand-soft),var(--cx-surface-2))]" />
          <CardContent className="relative px-6 pb-8 pt-0 sm:px-8">
            <div className="-mt-14 mb-4 flex items-end justify-between gap-4 flex-wrap">
              <div className="size-24 overflow-hidden rounded-2xl border-4 border-[#101317] bg-[#1C2127] shadow-xl">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-[#8D8A84]">
                    <User className="size-10" />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <VCardExportButton
                  profile={{
                    fullName,
                    role: profile.currentRole,
                    bio: profile.bio,
                    city: profile.city,
                    timezone: profile.timezone,
                    socialLinks: profile.socialLinks,
                  }}
                  variant="secondary"
                  size="sm"
                />
                <Link href={`/login?next=/profile/${profileId}`}>
                  <Button variant="primary" icon={<Sparkles className="size-4" />}>
                    Connect with {firstName}
                  </Button>
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <CardTitle className="font-display text-2xl font-bold text-[#F1EEE7]">
                  {fullName}
                </CardTitle>
                {profile.currentRole ? (
                  <p className="mt-1 flex items-center gap-2 text-sm text-[#D0A45B]">
                    <Briefcase className="size-4 shrink-0" />
                    {profile.currentRole}
                  </p>
                ) : null}
              </div>

              {profile.bio ? (
                <p className="text-sm leading-relaxed text-[#8D8A84]">
                  {profile.bio}
                </p>
              ) : null}

              {profile.socialLinks ? (
                <div className="pt-2 pb-1">
                  <SocialLinksBar
                    socialLinks={profile.socialLinks}
                    size="sm"
                    showLabels
                  />
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-4 text-xs text-[#8D8A84] pt-2">
                {profile.timezone ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-[#D0A45B]" />
                    {profile.timezone}
                  </span>
                ) : null}
                {profile.availability?.days && profile.availability.days.length > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-[#D0A45B]" />
                    {profile.availability.days.join(', ')}
                  </span>
                ) : null}
              </div>

              {profile.skills && profile.skills.length > 0 ? (
                <div className="pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8D8A84]">
                    Skills & Experience
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile.skills.map((skill) => (
                      <Badge key={skill} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {profile.lookingFor?.roles && profile.lookingFor.roles.length > 0 ? (
                <div className="pt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8D8A84]">
                    Looking for
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile.lookingFor.roles.map((role) => (
                      <Badge key={role} variant="brand">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
