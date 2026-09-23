'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardFooter,
  Combobox,
  DropZone,
  Input,
  Select,
  TagInput,
  Textarea,
} from '@/components/ui'
import {
  EducationCard,
  ExperienceCard,
  InterestsEditor,
} from '@/components/profile'
import { LoadingState } from '@/components/states/LoadingState'
import { ErrorState } from '@/components/states/ErrorState'
import { getOwnProfileAction } from '@/app/actions/profile-read'
import {
  confirmAvatarUploadAction,
  getAvatarUploadAction,
  getOwnConnectProfileAction,
  removeAvatarAction,
  updateIntroductionAction,
  updateProfileAction,
} from '@/app/actions/profiles'
import { computeCompleteness } from '@/services/profiles/completeness'
import {
  commitmentLevelSchema,
  workStyleSchema,
} from '@/services/profiles/profile.schema'
import { keys } from '@/client/query/keys'
import { queryClient, useQuery } from '@/client/query/client'
import { initialsForName } from '@/types/profile'
import { showErrorToast, showSuccessToast } from '@/lib/toast'

type OwnProfile = Awaited<ReturnType<typeof getOwnProfileAction>>
type OwnConnectProfile = Awaited<ReturnType<typeof getOwnConnectProfileAction>>

const EDIT_QUERY_KEY = 'profile/edit'
const VIEW_MODEL_KEY = 'profile/edit/view-model'

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const WORK_STYLE_LABELS: Record<string, string> = {
  structured: 'Structured',
  flexible: 'Flexible',
  fast_iterate: 'Fast iterate',
  deliberate: 'Deliberate',
}

const COMMITMENT_LABELS: Record<string, string> = {
  exploring: 'Exploring',
  nights_weekends: 'Nights & Weekends',
  part_time: 'Part-Time',
  full_time: 'Full-Time',
}

// Curated quick-adds for the skills editor — the stored skills column is
// free-form text[], so these are suggestions, never a closed vocabulary.
const SKILL_SUGGESTIONS = [
  'react',
  'typescript',
  'node',
  'product design',
  'data',
  'marketing',
]

function formatMonthRange(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
  isCurrent: boolean,
): string {
  const fmt = (ym: string | null | undefined): string => {
    if (!ym) return ''
    const [year, month] = ym.split('-')
    const idx = parseInt(month, 10) - 1
    return idx >= 0 && idx < MONTH_NAMES.length && year
      ? `${MONTH_NAMES[idx]} ${year}`
      : year
  }
  const start = fmt(startedAt)
  const end = isCurrent ? 'Present' : fmt(endedAt)
  if (!start) return end
  return end ? `${start} – ${end}` : start
}

export default function EditProfilePage() {
  const router = useRouter()
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery<OwnProfile>(EDIT_QUERY_KEY, () => getOwnProfileAction())
  const { data: viewModel, isLoading: vmLoading } =
    useQuery<OwnConnectProfile | null>(VIEW_MODEL_KEY, () =>
      getOwnConnectProfileAction(),
    )

  const [name, setName] = useState('')
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [role, setRole] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [workStyle, setWorkStyle] = useState<
    'structured' | 'flexible' | 'fast_iterate' | 'deliberate' | ''
  >('')
  const [commitmentLevel, setCommitmentLevel] = useState<
    'exploring' | 'nights_weekends' | 'part_time' | 'full_time' | ''
  >('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>(
    'idle',
  )
  // The exact message the rejected section returned; never a generic string
  // when the server already explained what failed.
  const [saveError, setSaveError] = useState<string | null>(null)

  // Prefill from the real profile once (no hard-coded identity). Identity fields
  // (name, role) are provider-owned and read-only in the UI — they are never
  // written back through the user edit boundary.
  const [loadedProfile, setLoadedProfile] = useState<OwnProfile | null>(null)
  if (profile && profile !== loadedProfile) {
    setLoadedProfile(profile)
    setName(profile.fullName ?? '')
    setHeadline(profile.headline ?? '')
    setBio(profile.bio ?? '')
    if (profile.role) setRole(profile.role === '' ? 'other' : profile.role)
    setSkills(profile.skills ?? [])
    // Enum fields narrow through the SAME schema the <Select> renders from, so
    // a legacy/unknown stored value degrades to "Select…" instead of poisoning
    // typed state. One source of truth: services/profiles/profile.schema.
    const storedWorkStyle = workStyleSchema.safeParse(profile.workStyle)
    setWorkStyle(storedWorkStyle.success ? storedWorkStyle.data : '')
    const storedCommitment = commitmentLevelSchema.safeParse(
      profile.commitmentLevel,
    )
    setCommitmentLevel(storedCommitment.success ? storedCommitment.data : '')
  }

  const completeness = computeCompleteness({
    fullName: name,
    role,
    bio,
    skills,
    timezone: profile?.timezone,
    availability: profile?.availability,
    lookingFor: profile?.lookingFor,
    avatarUrl: profile?.avatarUrl,
    commitmentLevel: commitmentLevel || undefined,
    workStyle: workStyle || undefined,
    visibility: profile?.visibility,
  })

  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  async function handleSave() {
    setSaveState('saving')
    setSaveError(null)
    try {
      // Introduction section: headline + bio are user-owned, persisted through
      // the section action (never a provider key).
      const introduction = await updateIntroductionAction({
        headline: headline || null,
        bio: bio || null,
      })
      if (!introduction.ok) {
        setSaveError(introduction.error)
        setSaveState('error')
        return
      }
      // Context fields: skills + workStyle + commitmentLevel are user-owned.
      const context = await updateProfileAction({
        skills,
        workStyle: workStyle || undefined,
        commitmentLevel: commitmentLevel || undefined,
      })
      if (!context.ok) {
        setSaveError(context.error)
        setSaveState('error')
        return
      }
      queryClient.invalidate(keys.profile('me').join('/'))
      queryClient.invalidate(EDIT_QUERY_KEY)
      router.push('/dashboard/profile')
    } catch {
      // Only transports/timeouts land here — the section actions report
      // validation and authorization failures as results, not throws.
      setSaveError('Something went wrong saving. Please try again.')
      setSaveState('error')
    }
  }

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
      queryClient.invalidate(EDIT_QUERY_KEY)
      showSuccessToast('Profile photo updated')
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
      queryClient.invalidate(keys.profile('me').join('/'))
      queryClient.invalidate(EDIT_QUERY_KEY)
      showSuccessToast('Profile photo removed')
    } catch {
      setAvatarError('Something went wrong. Please try again.')
      showErrorToast('Something went wrong. Please try again.')
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Profile"
          title="Edit profile"
          description="Keep the essentials current."
        />

        {isLoading ? (
          <LoadingState label="Loading profile…" />
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <Card>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="rounded-xl bg-[var(--cx-surface-2)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Profile photo</p>
                  {profile?.avatarUrl ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[var(--cx-danger)]"
                      disabled={avatarBusy}
                      onClick={() => void handleRemoveAvatar()}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar className="size-12 shrink-0 bg-[var(--cx-surface-3)]">
                    {profile?.avatarUrl ? (
                      <AvatarImage
                        src={profile.avatarUrl}
                        alt="Current profile photo"
                      />
                    ) : null}
                    <AvatarFallback>
                      {initialsForName(profile?.fullName ?? 'You')}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-xs text-[var(--cx-text-3)]">
                    {profile?.avatarUrl
                      ? 'Choose a photo below to replace it.'
                      : 'Add a photo so people can recognize you.'}
                  </p>
                </div>
                <div className="mt-3">
                  <DropZone
                    files={avatarFile ? [avatarFile] : []}
                    onFilesChange={(files) => {
                      setAvatarFile(files[0] ?? null)
                      setAvatarError(null)
                    }}
                    accept="image/png,image/jpeg,image/webp"
                    multiple={false}
                    label="Choose photo"
                    hint="PNG, JPG or WebP · up to 10 MB"
                    disabled={avatarBusy}
                  />
                </div>
                {avatarFile ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      disabled={avatarBusy}
                      onClick={() => void handleAvatarUpload()}
                    >
                      {avatarBusy ? 'Uploading…' : 'Use this photo'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={avatarBusy}
                      onClick={() => {
                        setAvatarFile(null)
                        setAvatarError(null)
                      }}
                    >
                      Cancel
                    </Button>
                    {avatarError ? (
                      <span
                        role="alert"
                        className="text-xs text-[var(--cx-danger)]"
                      >
                        {avatarError}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl bg-[var(--cx-surface-2)] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Profile completeness</p>
                  <span className="text-xs font-semibold text-[var(--cx-brand-strong)]">
                    {completeness.completionPct}%
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--cx-surface-3)]">
                  <div
                    className="h-full rounded-full bg-[var(--cx-brand)] transition-[width]"
                    style={{ width: `${completeness.completionPct}%` }}
                  />
                </div>
                {completeness.actionMissingFields.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {completeness.actionMissingFields.map((field) => (
                      <span
                        key={field}
                        className="rounded-full border border-[var(--cx-border-1)] px-2.5 py-1 text-[11px] text-[var(--cx-text-3)]"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                  Name
                </span>
                <Input value={name} disabled />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                  Headline
                </span>
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="A short line about what you do"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                  Bio
                </span>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder="A short bio…"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                  Role
                </span>
                <Select value={role} disabled>
                  <option value="founder">Founder</option>
                  <option value="designer">Designer</option>
                  <option value="engineer">Engineer</option>
                  <option value="facilitator">Facilitator</option>
                  <option value="other">Other</option>
                </Select>
              </label>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                    Skills
                  </span>
                  <TagInput
                    value={skills}
                    onChange={setSkills}
                    placeholder="Type a skill and press Enter"
                    suggestions={SKILL_SUGGESTIONS}
                    maxTags={20}
                  />
                </label>
                <div>
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                    Suggested
                  </span>
                  <InterestsEditor
                    interests={skills}
                    onInterestsChange={setSkills}
                    editable
                    suggestions={SKILL_SUGGESTIONS}
                    showInput={false}
                    onManage={() => router.push('/dashboard/profile')}
                  />
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                  Work style
                </span>
                <Combobox
                  options={workStyleSchema.options.map((option) => ({
                    value: option,
                    label: WORK_STYLE_LABELS[option] ?? option,
                  }))}
                  value={workStyle || null}
                  onChange={(value) => {
                    const parsed = workStyleSchema.safeParse(value)
                    setWorkStyle(parsed.success ? parsed.data : '')
                  }}
                  placeholder="Select…"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                  Commitment
                </span>
                <Combobox
                  options={commitmentLevelSchema.options.map((option) => ({
                    value: option,
                    label: COMMITMENT_LABELS[option] ?? option,
                  }))}
                  value={commitmentLevel || null}
                  onChange={(value) => {
                    const parsed = commitmentLevelSchema.safeParse(value)
                    setCommitmentLevel(parsed.success ? parsed.data : '')
                  }}
                  placeholder="Select…"
                />
              </label>
            </CardContent>
            <CardFooter className="justify-end border-t border-[var(--cx-border-1)] p-5">
              {saveState === 'error' && saveError ? (
                <span
                  role="alert"
                  className="mr-4 text-xs text-[var(--cx-danger)]"
                >
                  {saveError}
                </span>
              ) : null}
              <Button
                disabled={saveState === 'saving'}
                onClick={() => void handleSave()}
              >
                {saveState === 'saving' ? 'Saving…' : 'Save'}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/*
          Experience & Education are provider-synced (LinkedIn) via
          loadConnectProfile and have NO user-write path today. Rendered
          read-only through the shared cards, with the origin disclosed in the
          section caption rather than a fake inline editor.
        */}
        {!isLoading && !error && (
          <>
            <Card className="mt-6">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Experience</p>
                  <span className="rounded-full border border-[var(--cx-border-1)] px-2.5 py-1 text-[11px] text-[var(--cx-text-3)]">
                    Sync from LinkedIn
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--cx-text-4)]">
                  Read-only — edits come through LinkedIn sync.
                </p>
                {vmLoading ? (
                  <p className="mt-3 text-xs text-[var(--cx-text-4)]">
                    Loading synced experience…
                  </p>
                ) : (viewModel?.experience ?? []).length === 0 ? (
                  <p className="mt-3 text-xs text-[var(--cx-text-4)]">
                    No experience synced yet. Connect LinkedIn to populate this
                    section.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {(viewModel?.experience ?? []).map((item) => (
                      <li key={item.id}>
                        <ExperienceCard
                          role={item.title}
                          org={item.company ?? '—'}
                          period={formatMonthRange(
                            item.startedAt,
                            item.endedAt,
                            item.isCurrent,
                          )}
                          current={item.isCurrent}
                          source="LinkedIn sync"
                          description={item.description ?? undefined}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="mt-3">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Education</p>
                  <span className="rounded-full border border-[var(--cx-border-1)] px-2.5 py-1 text-[11px] text-[var(--cx-text-3)]">
                    Sync from LinkedIn
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--cx-text-4)]">
                  Read-only — edits come through LinkedIn sync.
                </p>
                {vmLoading ? (
                  <p className="mt-3 text-xs text-[var(--cx-text-4)]">
                    Loading synced education…
                  </p>
                ) : (viewModel?.education ?? []).length === 0 ? (
                  <p className="mt-3 text-xs text-[var(--cx-text-4)]">
                    No education synced yet. Connect LinkedIn to populate this
                    section.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {(viewModel?.education ?? []).map((item) => (
                      <li key={item.id}>
                        <EducationCard
                          school={item.school}
                          degree={item.degree ?? ''}
                          period={formatMonthRange(
                            item.startedAt,
                            item.endedAt,
                            item.isCurrent,
                          )}
                          issuer={item.fieldOfStudy ?? undefined}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
