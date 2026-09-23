'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Compass,
  Image as ImageIcon,
  Sparkles,
  Upload,
  User,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DropZone,
  Input,
  Progress,
  StatusPill,
  Stepper,
  Textarea,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { cn } from '@/utils/cn'
import { ROUTES } from '@/config/routes'
import { getOwnProfileAction } from '@/app/actions/profile-read'
import {
  completeOnboardingAction,
  saveOnboardingStepAction,
  type OnboardingActionResult,
} from '@/app/actions/onboarding'
import {
  confirmAvatarUploadAction,
  getAvatarUploadAction,
  removeAvatarAction,
} from '@/app/actions/profiles'
import {
  LOOKING_FOR_CATEGORIES,
  OFFERING_CATEGORIES,
  getIntentLabel,
} from '@/services/profiles/intent'
import { useQuery } from '@/client/query/client'
import { initialsForName } from '@/types/profile'
import { showErrorToast, showSuccessToast } from '@/lib/toast'

const HEADLINE_SUGGESTIONS = [
  'Founder building AI tools for builders',
  'Fullstack Engineer looking for co-founder',
  'Product Designer exploring early-stage teams',
  'Growth Strategist scaling B2B SaaS',
]

export default function OnboardingPage() {
  const router = useRouter()
  const [profileKey] = useState(() => ['own-profile', 'onboarding'].join('/'))
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery(profileKey, () => getOwnProfileAction())

  const [activeStep, setActiveStep] = useState(1)
  const [bioInput, setBioInput] = useState('')
  const [headlineInput, setHeadlineInput] = useState('')
  const [selectedLookingFor, setSelectedLookingFor] = useState<string[]>([])
  const [selectedOffering, setSelectedOffering] = useState<string[]>([])

  // Avatar handling state
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const [savingStep, setSavingStep] = useState(false)
  const [completing, setCompleting] = useState(false)

  // Sync state when profile loads
  useEffect(() => {
    if (profile) {
      if (profile.bio && !bioInput) setBioInput(profile.bio)
      if (profile.headline && !headlineInput) setHeadlineInput(profile.headline)
      if (profile.lookingFor?.roles && selectedLookingFor.length === 0) {
        setSelectedLookingFor(profile.lookingFor.roles)
      }
      if (profile.offering?.categories && selectedOffering.length === 0) {
        setSelectedOffering(profile.offering.categories)
      }
      if (profile.avatarUrl) {
        setAvatarPreviewUrl(profile.avatarUrl)
      }
    }
  }, [profile])

  // Instant local avatar preview
  useEffect(() => {
    if (!avatarFile) return
    const objectUrl = URL.createObjectURL(avatarFile)
    setAvatarPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [avatarFile])

  const hasBio = Boolean(bioInput.trim().length > 0)
  const hasLookingFor = selectedLookingFor.length > 0
  const hasOffering = selectedOffering.length > 0
  const isCompleted = profile?.onboardingStatus === 'completed'

  const steps = [
    {
      num: 1,
      title: 'About you & Photo',
      body: 'Your photo, headline, and bio.',
      done: hasBio,
    },
    {
      num: 2,
      title: 'Match interests',
      body: 'Roles and skills you want to find.',
      done: hasLookingFor,
    },
    {
      num: 3,
      title: 'What you offer',
      body: 'Skills and expertise you contribute.',
      done: hasOffering,
    },
    {
      num: 4,
      title: 'Review and finish',
      body: 'Preview your profile and go live.',
      done: isCompleted,
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const progressPct = Math.round((doneCount / steps.length) * 100)

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
        showErrorToast(confirmed.error ?? 'Photo upload could not be confirmed.')
        return
      }
      setAvatarFile(null)
      await refetch()
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
      setAvatarFile(null)
      setAvatarPreviewUrl(null)
      await refetch()
      showSuccessToast('Profile photo removed')
    } catch {
      setAvatarError('Something went wrong. Please try again.')
      showErrorToast('Something went wrong. Please try again.')
    } finally {
      setAvatarBusy(false)
    }
  }

  async function saveStep(stepNum: number) {
    setSavingStep(true)
    try {
      if (stepNum === 1) {
        if (avatarFile) {
          await handleAvatarUpload()
        }
        if (bioInput.trim()) {
          const res = await saveOnboardingStepAction({
            step: 'about',
            bio: bioInput.trim(),
          })
          if (!res.ok) {
            showErrorToast(res.error ?? 'Could not save bio.')
            setSavingStep(false)
            return false
          }
        }
      } else if (stepNum === 2) {
        if (selectedLookingFor.length > 0) {
          const res = await saveOnboardingStepAction({
            step: 'lookingFor',
            lookingFor: { roles: selectedLookingFor },
          })
          if (!res.ok) {
            showErrorToast(res.error ?? 'Could not save match interests.')
            setSavingStep(false)
            return false
          }
        }
      } else if (stepNum === 3) {
        if (selectedOffering.length > 0) {
          const res = await saveOnboardingStepAction({
            step: 'offering',
            offering: { categories: selectedOffering },
          })
          if (!res.ok) {
            showErrorToast(res.error ?? 'Could not save offering.')
            setSavingStep(false)
            return false
          }
        }
      }
      await refetch().catch(() => undefined)
      return true
    } catch {
      showErrorToast('Failed to save step changes.')
      return false
    } finally {
      setSavingStep(false)
    }
  }

  async function handleStepClick(targetStep: number) {
    if (targetStep === activeStep || savingStep) return
    const success = await saveStep(activeStep)
    if (success) {
      setActiveStep(targetStep)
    }
  }

  async function handleNextStep() {
    const success = await saveStep(activeStep)
    if (success && activeStep < steps.length) {
      setActiveStep(activeStep + 1)
    }
  }

  async function handleFinish() {
    if (completing) return
    setCompleting(true)
    let result: OnboardingActionResult
    try {
      // Save all current step states first
      await saveStep(1)
      await saveStep(2)
      await saveStep(3)
      result = await completeOnboardingAction()
    } catch {
      showErrorToast('Something went wrong. Please try again.')
      setCompleting(false)
      return
    }
    if (!result.ok) {
      showErrorToast(result.error ?? 'Something went wrong. Please try again.')
      setCompleting(false)
      return
    }
    await refetch().catch(() => undefined)
    showSuccessToast('Your profile is live!')
    router.push(ROUTES.discover)
  }

  function toggleLookingForRole(val: string) {
    setSelectedLookingFor((prev) =>
      prev.includes(val) ? prev.filter((r) => r !== val) : [...prev, val].slice(0, 5)
    )
  }

  function toggleOfferingCategory(val: string) {
    setSelectedOffering((prev) =>
      prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val].slice(0, 5)
    )
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[720px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Onboarding Wizard"
          title="Set up your profile"
          description="Build your profile step by step to connect with the right people."
        />

        {isLoading ? (
          <LoadingState label="Loading onboarding status…" />
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <>
            {/* Interactive Stepper & Step Progress Bar */}
            <div className="mb-6 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-4 shadow-xs">
              <Stepper
                steps={steps.map((s) => ({ label: s.title }))}
                current={activeStep - 1}
                onStepClick={(index: number) => void handleStepClick(index + 1)}
              />

              <div className="mt-4 pt-3 border-t border-[var(--cx-border-1)]">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--cx-text-3)]">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-[var(--cx-brand-strong)]" />
                    Step {activeStep} of {steps.length}: {steps[activeStep - 1]?.title}
                  </span>
                  <span>{progressPct}% Complete</span>
                </div>
                <Progress value={doneCount} max={steps.length} className="h-2" />
              </div>
            </div>

            {/* Active Step Form Content */}
            <Card className="shadow-[var(--cx-shadow-card)]">
              <CardHeader className="border-b border-[var(--cx-border-1)] bg-[var(--cx-surface-2)]/50 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-[var(--cx-brand)] text-xs font-bold text-white shadow-xs">
                      {activeStep}
                    </span>
                    <div>
                      <CardTitle className="text-lg">{steps[activeStep - 1]?.title}</CardTitle>
                      <CardDescription>{steps[activeStep - 1]?.body}</CardDescription>
                    </div>
                  </div>
                  <StatusPill
                    label={steps[activeStep - 1]?.done ? 'Complete' : 'In Progress'}
                    tone={steps[activeStep - 1]?.done ? 'success' : 'neutral'}
                  />
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* STEP 1: Bio & Avatar */}
                {activeStep === 1 && (
                  <div className="space-y-5">
                    {/* Instant Avatar Upload / Dropzone */}
                    <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-4)] flex items-center gap-1.5">
                          <ImageIcon className="size-3.5 text-[var(--cx-brand-strong)]" /> Instant Profile Photo Preview
                        </label>
                        {avatarPreviewUrl ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[var(--cx-danger)] text-xs h-7"
                            disabled={avatarBusy}
                            onClick={() => void handleRemoveAvatar()}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-4">
                        <Avatar className="size-16 shrink-0 ring-2 ring-[var(--cx-brand)] shadow-md">
                          {avatarPreviewUrl ? (
                            <AvatarImage src={avatarPreviewUrl} alt="Avatar Preview" />
                          ) : null}
                          <AvatarFallback className="bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)] font-bold text-lg">
                            {initialsForName(profile?.fullName ?? 'You')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-xs text-[var(--cx-text-3)] leading-relaxed">
                          <p className="font-medium text-[var(--cx-text-1)]">
                            {avatarFile ? 'Ready to upload preview photo' : 'Upload your profile photo'}
                          </p>
                          <p>PNG, JPG or WebP up to 10 MB. High quality headshots convert 3x better.</p>
                        </div>
                      </div>

                      <DropZone
                        files={avatarFile ? [avatarFile] : []}
                        onFilesChange={(files) => {
                          setAvatarFile(files[0] ?? null)
                          setAvatarError(null)
                        }}
                        accept="image/png,image/jpeg,image/webp"
                        multiple={false}
                        label="Drop photo here or click to choose file"
                        hint="Instant image preview enabled"
                        disabled={avatarBusy}
                      />

                      {avatarFile && (
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            disabled={avatarBusy}
                            onClick={() => void handleAvatarUpload()}
                          >
                            {avatarBusy ? 'Uploading photo…' : 'Save Photo Now'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={avatarBusy}
                            onClick={() => {
                              setAvatarFile(null)
                              setAvatarPreviewUrl(profile?.avatarUrl ?? null)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}

                      {avatarError && (
                        <p role="alert" className="text-xs text-[var(--cx-danger)]">
                          {avatarError}
                        </p>
                      )}
                    </div>

                    {/* Bio & Headline with Smart Suggestions */}
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                          Headline
                        </label>
                        <Input
                          placeholder="e.g. Founder building AI tools for builders"
                          value={headlineInput}
                          onChange={(e) => setHeadlineInput(e.target.value)}
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-[var(--cx-text-4)] uppercase font-semibold">
                            Suggestions:
                          </span>
                          {HEADLINE_SUGGESTIONS.map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => setHeadlineInput(sug)}
                              className="rounded-full bg-[var(--cx-surface-2)] px-2.5 py-0.5 text-[11px] text-[var(--cx-text-2)] border border-[var(--cx-border-1)] hover:border-[var(--cx-brand-soft)] hover:text-[var(--cx-brand-strong)] transition-colors"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                          Bio
                        </label>
                        <Textarea
                          placeholder="A few lines on what you're building, what drives you, and what you are looking to collaborate on..."
                          rows={4}
                          value={bioInput}
                          onChange={(e) => setBioInput(e.target.value)}
                        />
                        <p className="mt-1 text-[11px] text-[var(--cx-text-4)] text-right">
                          {bioInput.length} / 500 characters
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Match Interests with Preset Skill Chips */}
                {activeStep === 2 && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs text-[var(--cx-text-3)] leading-relaxed mb-3">
                        Select the primary roles and disciplines you want to match or team up with (up to 5):
                      </p>
                      
                      {/* Quick Skill Preset Chips Bar */}
                      <div className="mb-4 rounded-xl bg-[var(--cx-surface-2)] p-3 border border-[var(--cx-border-1)] space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                          Quick Preset Skill Chips ({selectedLookingFor.length}/5 selected)
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {LOOKING_FOR_CATEGORIES.map((cat) => {
                            const isSelected = selectedLookingFor.includes(cat.value)
                            return (
                              <button
                                key={cat.value}
                                type="button"
                                onClick={() => toggleLookingForRole(cat.value)}
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all border',
                                  isSelected
                                    ? 'bg-[var(--cx-brand)] text-white border-[var(--cx-brand)] shadow-xs'
                                    : 'bg-[var(--cx-surface-1)] text-[var(--cx-text-2)] border-[var(--cx-border-1)] hover:border-[var(--cx-border-2)]'
                                )}
                              >
                                {isSelected ? <Check className="size-3" /> : null}
                                {cat.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Category Cards */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {LOOKING_FOR_CATEGORIES.map((cat) => {
                        const isSelected = selectedLookingFor.includes(cat.value)
                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => toggleLookingForRole(cat.value)}
                            className={cn(
                              'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
                              isSelected
                                ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)]/20 shadow-xs'
                                : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] hover:border-[var(--cx-border-2)]'
                            )}
                          >
                            <div
                              className={cn(
                                'flex size-5 shrink-0 items-center justify-center rounded-full mt-0.5 border transition-colors',
                                isSelected
                                  ? 'border-[var(--cx-brand)] bg-[var(--cx-brand)] text-white'
                                  : 'border-[var(--cx-border-2)] bg-[var(--cx-surface-2)]'
                              )}
                            >
                              {isSelected && <Check className="size-3" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[var(--cx-text-1)]">
                                {cat.label}
                              </p>
                              <p className="text-[11px] text-[var(--cx-text-3)] leading-snug mt-0.5">
                                {cat.description}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* STEP 3: What You Offer with Preset Skill Chips */}
                {activeStep === 3 && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs text-[var(--cx-text-3)] leading-relaxed mb-3">
                        Select what expertise and disciplines you bring to collaborations (up to 5):
                      </p>

                      {/* Quick Skill Preset Chips Bar */}
                      <div className="mb-4 rounded-xl bg-[var(--cx-surface-2)] p-3 border border-[var(--cx-border-1)] space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                          Quick Preset Skill Chips ({selectedOffering.length}/5 selected)
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {OFFERING_CATEGORIES.map((cat) => {
                            const isSelected = selectedOffering.includes(cat.value)
                            return (
                              <button
                                key={cat.value}
                                type="button"
                                onClick={() => toggleOfferingCategory(cat.value)}
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all border',
                                  isSelected
                                    ? 'bg-[var(--cx-brand-strong)] text-white border-[var(--cx-brand-strong)] shadow-xs'
                                    : 'bg-[var(--cx-surface-1)] text-[var(--cx-text-2)] border-[var(--cx-border-1)] hover:border-[var(--cx-border-2)]'
                                )}
                              >
                                {isSelected ? <Check className="size-3" /> : null}
                                {cat.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Category Cards */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {OFFERING_CATEGORIES.map((cat) => {
                        const isSelected = selectedOffering.includes(cat.value)
                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => toggleOfferingCategory(cat.value)}
                            className={cn(
                              'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
                              isSelected
                                ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)]/20 shadow-xs'
                                : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] hover:border-[var(--cx-border-2)]'
                            )}
                          >
                            <div
                              className={cn(
                                'flex size-5 shrink-0 items-center justify-center rounded-full mt-0.5 border transition-colors',
                                isSelected
                                  ? 'border-[var(--cx-brand)] bg-[var(--cx-brand)] text-white'
                                  : 'border-[var(--cx-border-2)] bg-[var(--cx-surface-2)]'
                              )}
                            >
                              {isSelected && <Check className="size-3" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[var(--cx-text-1)]">
                                {cat.label}
                              </p>
                              <p className="text-[11px] text-[var(--cx-text-3)] leading-snug mt-0.5">
                                {cat.description}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* STEP 4: Review and Finish */}
                {activeStep === 4 && (
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-5 space-y-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="size-16 shrink-0 ring-2 ring-[var(--cx-brand)]">
                          {avatarPreviewUrl ? (
                            <AvatarImage src={avatarPreviewUrl} alt="Live Profile Preview" />
                          ) : null}
                          <AvatarFallback className="bg-[var(--cx-brand)] text-white font-bold text-xl">
                            {initialsForName(profile?.fullName ?? 'You')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="text-base font-bold text-[var(--cx-text-1)]">
                            {profile?.fullName ?? 'Your Profile'}
                          </h3>
                          <p className="text-xs text-[var(--cx-brand-strong)] font-medium mt-0.5">
                            {headlineInput || profile?.headline || 'Member'}
                          </p>
                          <p className="text-xs text-[var(--cx-text-3)] mt-1">
                            {profile?.city || 'Location unset'}
                          </p>
                        </div>
                      </div>

                      {bioInput && (
                        <div className="border-t border-[var(--cx-border-1)] pt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)] mb-1">
                            Bio
                          </p>
                          <p className="text-xs text-[var(--cx-text-2)] leading-relaxed italic">
                            &ldquo;{bioInput}&rdquo;
                          </p>
                        </div>
                      )}

                      <div className="grid gap-3 sm:grid-cols-2 border-t border-[var(--cx-border-1)] pt-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)] mb-1.5">
                            Looking for
                          </p>
                          {selectedLookingFor.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {selectedLookingFor.map((role) => (
                                <span
                                  key={role}
                                  className="rounded-full bg-[var(--cx-surface-1)] border border-[var(--cx-border-1)] px-2.5 py-0.5 text-[11px] text-[var(--cx-text-2)]"
                                >
                                  {getIntentLabel(role) ?? role}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-[var(--cx-text-4)]">None selected</p>
                          )}
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)] mb-1.5">
                            Offering
                          </p>
                          {selectedOffering.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {selectedOffering.map((cat) => (
                                <span
                                  key={cat}
                                  className="rounded-full bg-[var(--cx-brand-soft)]/30 border border-[var(--cx-brand-soft)] px-2.5 py-0.5 text-[11px] text-[var(--cx-brand-strong)]"
                                >
                                  {getIntentLabel(cat) ?? cat}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-[var(--cx-text-4)]">None selected</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[var(--cx-surface-1)] border border-[var(--cx-border-1)] p-4 flex items-center gap-3">
                      <CheckCircle2 className="size-5 text-[var(--cx-success)] shrink-0" />
                      <p className="text-xs text-[var(--cx-text-3)] leading-relaxed">
                        Ready to launch? Completing onboarding saves your profile and takes you straight to your Discover feed to start connecting.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>

              {/* Wizard Footer Action Controls */}
              <CardFooter className="flex items-center justify-between border-t border-[var(--cx-border-1)] bg-[var(--cx-surface-2)]/30 p-4 sm:p-6">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={activeStep === 1 || savingStep}
                  onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
                  icon={<ArrowLeft className="size-3.5" />}
                >
                  Previous
                </Button>

                {activeStep < steps.length ? (
                  <Button
                    size="sm"
                    disabled={savingStep}
                    onClick={() => void handleNextStep()}
                  >
                    {savingStep ? (
                      'Saving step…'
                    ) : (
                      <>
                        Save &amp; Continue <ArrowRight className="size-3.5 ml-1" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={completing || savingStep}
                    onClick={() => void handleFinish()}
                    className="bg-[var(--cx-brand)] text-white hover:bg-[var(--cx-brand-strong)] px-6"
                  >
                    {completing ? (
                      'Finishing setup…'
                    ) : (
                      <>
                        Complete Setup &amp; Launch Discover <Compass className="size-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
