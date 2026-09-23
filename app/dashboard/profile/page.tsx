'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  ImageIcon,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropZone,
  Progress,
  Separator,
} from '@/components/ui'
import {
  ProfileHeader,
  ProfileSection,
  SocialLinksBar,
  VCardExportButton,
} from '@/components/profile'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { formatLocation } from '@/utils/format-location'
import {
  getIntentLabel,
  getLookingForDescription,
  getOfferingDescription,
} from '@/services/profiles/intent'
import { keys } from '@/client/query/keys'
import { useQuery, queryClient } from '@/client/query/client'
import { fetchOwnProfile } from '@/client/api/profiles'
import { getOwnProfileAction } from '@/app/actions/profile-read'
import {
  confirmAvatarUploadAction,
  getAvatarUploadAction,
  removeAvatarAction,
} from '@/app/actions/profiles'
import { computeCompleteness } from '@/services/profiles/completeness'
import { initialsForName } from '@/types/profile'
import { showErrorToast, showSuccessToast } from '@/lib/toast'

export default function ProfilePage() {
  const [profileKey] = useState(() => keys.profile('me').join('/'))
  const { data, isLoading, error, refetch } = useQuery(profileKey, () =>
    fetchOwnProfile(),
  )

  const [fullProfileKey] = useState(() => ['own-profile', 'page'].join('/'))
  const { data: fullProfile } = useQuery(fullProfileKey, () =>
    getOwnProfileAction(),
  )

  // Avatar Photo Modal state
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  // Active view tab state
  const [activeTab, setActiveTab] = useState<
    'overview' | 'intentions' | 'completeness'
  >('overview')

  // Handle local avatar preview
  useEffect(() => {
    if (!avatarFile) return
    const objectUrl = URL.createObjectURL(avatarFile)
    setAvatarPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [avatarFile])

  useEffect(() => {
    if (data?.avatar_url) {
      setAvatarPreviewUrl(data.avatar_url)
    }
  }, [data])

  const completeness = fullProfile
    ? computeCompleteness({
        fullName: fullProfile.fullName,
        role: fullProfile.role,
        bio: fullProfile.bio,
        skills: fullProfile.skills,
        timezone: fullProfile.timezone,
        availability: fullProfile.availability,
        lookingFor: fullProfile.lookingFor,
        avatarUrl: fullProfile.avatarUrl,
        commitmentLevel: fullProfile.commitmentLevel,
        workStyle: fullProfile.workStyle,
        visibility: fullProfile.visibility,
      })
    : null

  async function handleAvatarUpload() {
    if (!avatarFile || avatarBusy) return
    setAvatarBusy(true)
    setAvatarError(null)
    try {
      const grant = await getAvatarUploadAction(avatarFile.type)
      if (!grant.ok) {
        setAvatarError(grant.error)
        showErrorToast(grant.error ?? 'Photo upload could not be started.')
        return
      }
      const put = await fetch(grant.url, {
        method: 'PUT',
        headers: { 'Content-Type': avatarFile.type },
        body: avatarFile,
      })
      if (!put.ok) {
        setAvatarError('The photo upload failed. Please try again.')
        showErrorToast('The photo upload failed. Please try again.')
        return
      }
      const confirmed = await confirmAvatarUploadAction(grant.path)
      if (!confirmed.ok) {
        setAvatarError(confirmed.error)
        showErrorToast(
          confirmed.error ?? 'Photo upload could not be confirmed.',
        )
        return
      }
      setAvatarFile(null)
      queryClient.invalidate(keys.profile('me').join('/'))
      queryClient.invalidate(profileKey)
      queryClient.invalidate(fullProfileKey)
      await refetch()
      showSuccessToast('Profile photo updated successfully!')
      setIsAvatarModalOpen(false)
    } catch {
      setAvatarError('Something went wrong uploading. Please try again.')
      showErrorToast('Something went wrong uploading. Please try again.')
    } finally {
      setAvatarBusy(false)
    }
  }

  async function handleRemoveAvatar() {
    if (avatarBusy) return
    setAvatarBusy(true)
    setAvatarError(null)
    try {
      const result = await removeAvatarAction()
      if (!result.ok) {
        setAvatarError(result.error)
        showErrorToast(result.error ?? 'Photo could not be removed.')
        return
      }
      setAvatarFile(null)
      setAvatarPreviewUrl(null)
      queryClient.invalidate(keys.profile('me').join('/'))
      queryClient.invalidate(profileKey)
      queryClient.invalidate(fullProfileKey)
      await refetch()
      showSuccessToast('Profile photo removed')
      setIsAvatarModalOpen(false)
    } catch {
      setAvatarError('Something went wrong. Please try again.')
      showErrorToast('Something went wrong. Please try again.')
    } finally {
      setAvatarBusy(false)
    }
  }

  function copyProfileLink() {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/dashboard/profile/preview`
      navigator.clipboard.writeText(url).then(
        () => showSuccessToast('Profile preview link copied to clipboard!'),
        () => showErrorToast('Could not copy link.'),
      )
    }
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[780px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Identity & Presence"
          title="Your profile"
          description="How the community sees you across Connect."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<Copy className="size-3.5" />}
                onClick={copyProfileLink}
              >
                Share
              </Button>
              <Link href="/dashboard/profile/preview">
                <Button variant="secondary" size="sm" icon={<Eye className="size-3.5" />}>
                  Preview
                </Button>
              </Link>
              <Link href="/dashboard/profile/edit">
                <Button size="sm" icon={<Edit3 className="size-3.5" />}>
                  Edit profile
                </Button>
              </Link>
            </div>
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
          <div className="mt-6 space-y-5">
            {/* Main Profile Identity Card */}
            <Card className="relative overflow-hidden border-[var(--cx-border-1)] shadow-[var(--cx-shadow-card)]">
              <div className="h-24 w-full bg-gradient-to-r from-[var(--cx-brand)]/20 via-[var(--cx-brand-soft)]/30 to-[var(--cx-surface-3)]" />
              <CardContent className="p-6 pt-0 relative">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 mb-4">
                  {/* Interactive Avatar with Photo Overlay Button */}
                  <div className="relative group size-20 sm:size-24 shrink-0">
                    <Avatar className="size-full ring-4 ring-[var(--cx-surface-1)] shadow-md">
                      {data.avatar_url ? (
                        <AvatarImage src={data.avatar_url} alt={data.full_name} />
                      ) : null}
                      <AvatarFallback className="bg-[var(--cx-brand)] text-white font-bold text-2xl">
                        {initialsForName(data.full_name ?? 'You')}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      onClick={() => setIsAvatarModalOpen(true)}
                      className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      title="Update profile photo"
                    >
                      <Camera className="size-5" />
                      <span className="text-[10px] font-semibold mt-0.5">Edit</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsAvatarModalOpen(true)}
                      icon={<Camera className="size-3.5 text-[var(--cx-brand-strong)]" />}
                    >
                      Manage Photo
                    </Button>
                    <Link href="/dashboard/profile/edit">
                      <Button variant="ghost" size="sm">
                        Edit details
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-[var(--cx-text-1)]">
                      {data.full_name}
                    </h2>
                    <Badge variant="brand" className="text-[10px]">
                      <UserCheck className="size-3" /> Verified
                    </Badge>
                  </div>

                  <p className="text-sm font-medium text-[var(--cx-brand-strong)]">
                    {data.headline ||
                      (data.role ? getIntentLabel(data.role) ?? '' : '')}
                  </p>

                  {data.city && (
                    <p className="text-xs text-[var(--cx-text-3)]">
                      📍 {formatLocation(data.city, '', '')}
                    </p>
                  )}

                  {data.bio && (
                    <p className="text-xs text-[var(--cx-text-2)] leading-relaxed pt-2 border-t border-[var(--cx-border-1)]/60">
                      {data.bio}
                    </p>
                  )}

                  {(data.social_links || data.socialLinks) && (
                    <div className="pt-3 border-t border-[var(--cx-border-1)]/60">
                      <SocialLinksBar
                        socialLinks={data.social_links ?? data.socialLinks}
                        size="sm"
                        showLabels
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Profile Completeness Banner */}
            {completeness && (
              <Card className="border-[var(--cx-border-1)] bg-[var(--cx-surface-2)]/60 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-[var(--cx-brand-strong)]" />
                    <span className="text-xs font-semibold text-[var(--cx-text-1)]">
                      Profile Completeness
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[var(--cx-brand-strong)]">
                    {completeness.completionPct}%
                  </span>
                </div>
                <Progress value={completeness.completionPct} max={100} className="h-2 mb-3" />

                {completeness.actionMissingFields.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--cx-text-3)]">
                      Add missing items to boost match visibility:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {completeness.actionMissingFields.map((field) => (
                        <span
                          key={field}
                          className="rounded-full bg-[var(--cx-surface-1)] border border-[var(--cx-border-1)] px-2 py-0.5 text-[10px] text-[var(--cx-text-2)]"
                        >
                          + {field}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--cx-success)] font-medium">
                    ✓ Your profile is 100% complete and fully optimized for discovery.
                  </p>
                )}
              </Card>
            )}

            {/* Section Tabs */}
            <div className="flex rounded-full bg-[var(--cx-surface-2)] p-1 border border-[var(--cx-border-1)] text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex-1 py-2 text-center rounded-full font-medium transition-all ${
                  activeTab === 'overview'
                    ? 'bg-[var(--cx-surface-1)] text-[var(--cx-text-1)] shadow-xs font-semibold'
                    : 'text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)]'
                }`}
              >
                Overview &amp; Skills
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('intentions')}
                className={`flex-1 py-2 text-center rounded-full font-medium transition-all ${
                  activeTab === 'intentions'
                    ? 'bg-[var(--cx-surface-1)] text-[var(--cx-text-1)] shadow-xs font-semibold'
                    : 'text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)]'
                }`}
              >
                Match Intentions
              </button>
            </div>

            {/* TAB 1: Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-[var(--cx-text-1)] uppercase tracking-wider text-[10px]">
                      Skills &amp; Expertise
                    </h3>
                    {data.skills.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {data.skills.map((skill) => (
                          <li
                            key={skill}
                            className="rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-1 text-xs font-medium text-[var(--cx-text-1)]"
                          >
                            {skill}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[var(--cx-text-4)]">
                        No skills listed yet. Add skills in edit profile.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {fullProfile && (
                  <Card>
                    <CardContent className="p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-[var(--cx-text-1)] uppercase tracking-wider text-[10px]">
                        Work Style &amp; Availability
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 text-xs">
                        <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3">
                          <span className="text-[var(--cx-text-4)] block font-semibold text-[10px] uppercase">
                            Work Style
                          </span>
                          <span className="font-medium text-[var(--cx-text-1)] mt-0.5 block">
                            {fullProfile.workStyle || 'Flexible / Unspecified'}
                          </span>
                        </div>
                        <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3">
                          <span className="text-[var(--cx-text-4)] block font-semibold text-[10px] uppercase">
                            Commitment Level
                          </span>
                          <span className="font-medium text-[var(--cx-text-1)] mt-0.5 block">
                            {fullProfile.commitmentLevel || 'Exploring opportunities'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* TAB 2: Intentions */}
            {activeTab === 'intentions' && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-4)] mb-2">
                        Looking For
                      </h3>
                      {fullProfile?.lookingFor.roles && fullProfile.lookingFor.roles.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {fullProfile.lookingFor.roles.map((role) => (
                            <div
                              key={role}
                              className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3 text-xs"
                            >
                              <p className="font-semibold text-[var(--cx-text-1)]">
                                {getIntentLabel(role) ?? role}
                              </p>
                              <p className="text-[11px] text-[var(--cx-text-3)] mt-0.5">
                                {getLookingForDescription(role)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--cx-text-4)]">
                          No match roles specified yet.
                        </p>
                      )}
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-4)] mb-2">
                        What You Offer
                      </h3>
                      {fullProfile?.offering.categories && fullProfile.offering.categories.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {fullProfile.offering.categories.map((cat) => (
                            <div
                              key={cat}
                              className="rounded-xl border border-[var(--cx-brand-soft)] bg-[var(--cx-brand-soft)]/20 p-3 text-xs"
                            >
                              <p className="font-semibold text-[var(--cx-brand-strong)]">
                                {getIntentLabel(cat) ?? cat}
                              </p>
                              <p className="text-[11px] text-[var(--cx-text-3)] mt-0.5">
                                {getOfferingDescription(cat)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--cx-text-4)]">
                          No offerings specified yet.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Avatar Modal Dialog */}
        <Dialog open={isAvatarModalOpen} onOpenChange={setIsAvatarModalOpen}>
          <DialogContent className="max-w-md">
            <DialogClose onClick={() => setIsAvatarModalOpen(false)} />
            <DialogTitle>Manage Profile Photo</DialogTitle>
            <DialogDescription>
              Upload a new profile picture or remove your existing avatar.
            </DialogDescription>

            <div className="my-4 space-y-4">
              <div className="flex items-center justify-center">
                <Avatar className="size-28 ring-4 ring-[var(--cx-brand)] shadow-lg">
                  {avatarPreviewUrl ? (
                    <AvatarImage src={avatarPreviewUrl} alt="Photo Preview" />
                  ) : null}
                  <AvatarFallback className="bg-[var(--cx-brand)] text-white font-bold text-3xl">
                    {initialsForName(data?.full_name ?? 'You')}
                  </AvatarFallback>
                </Avatar>
              </div>

              <DropZone
                files={avatarFile ? [avatarFile] : []}
                onFilesChange={(files) => {
                  setAvatarFile(files[0] ?? null)
                  setAvatarError(null)
                }}
                accept="image/png,image/jpeg,image/webp"
                multiple={false}
                label="Choose image file"
                hint="PNG, JPG or WebP up to 10 MB"
                disabled={avatarBusy}
              />

              {avatarError && (
                <p role="alert" className="text-xs text-[var(--cx-danger)] text-center">
                  {avatarError}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--cx-border-1)]">
              {data?.avatar_url ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--cx-danger)]"
                  disabled={avatarBusy}
                  onClick={() => void handleRemoveAvatar()}
                  icon={<Trash2 className="size-3.5" />}
                >
                  Remove Photo
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={avatarBusy}
                  onClick={() => setIsAvatarModalOpen(false)}
                >
                  Cancel
                </Button>
                {avatarFile && (
                  <Button
                    size="sm"
                    disabled={avatarBusy}
                    onClick={() => void handleAvatarUpload()}
                    icon={<Upload className="size-3.5" />}
                  >
                    {avatarBusy ? 'Saving…' : 'Save Photo'}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
