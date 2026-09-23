'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
  StatusPill,
  Stepper,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { cn } from '@/utils/cn'
import { getOwnProfileAction } from '@/app/actions/profile-read'
import {
  completeOnboardingAction,
  type OnboardingActionResult,
} from '@/app/actions/onboarding'
import { useQuery } from '@/client/query/client'
import { showErrorToast, showSuccessToast } from '@/lib/toast'

export default function OnboardingPage() {
  const router = useRouter()
  const [profileKey] = useState(() => ['own-profile', 'onboarding'].join('/'))
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery(profileKey, () => getOwnProfileAction())
  const [completing, setCompleting] = useState(false)

  const hasBio = Boolean(profile?.bio && profile.bio.trim().length > 0)
  const hasOffering = (profile?.offering.categories.length ?? 0) > 0
  const hasLookingFor = (profile?.lookingFor.roles.length ?? 0) > 0
  // P0-09: every step maps to a REAL persisted requirement. The old
  // "Connect a calendar" step (done: false, no integration) was removed — it
  // could never be completed, so it only depressed the completion percentage.
  // This list is the mirror of ONBOARDING_REQUIREMENTS in the state machine.
  const steps = [
    {
      num: 1,
      title: 'About you',
      body: "A few lines on what you're building and why it matters.",
      done: hasBio,
    },
    {
      num: 2,
      title: 'Add your first match interest',
      body: "Pick a topic you'd love to talk through.",
      done: hasLookingFor,
    },
    {
      num: 3,
      title: 'What you offer',
      body: 'Skills and ways you can show up for others.',
      done: hasOffering,
    },
    {
      num: 4,
      title: 'Review and finish',
      body: "One last look before you're live.",
      done: profile?.onboardingStatus === 'completed',
    },
  ]

  const current = steps.filter((s) => !s.done).slice(0, 3)
  const doneCount = steps.filter((s) => s.done).length
  const progressPct = Math.round((doneCount / steps.length) * 100)
  const firstIncomplete = steps.findIndex((s) => !s.done)
  const currentStep = firstIncomplete === -1 ? steps.length : firstIncomplete

  async function handleFinish() {
    if (completing) return
    setCompleting(true)
    let result: OnboardingActionResult
    try {
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
    router.push('/dashboard/profile/edit')
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[680px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Step-by-step"
          title="Set up your profile"
          description="A few short steps to be discoverable."
        />

        {isLoading ? (
          <LoadingState label="Loading profile status…" />
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <>
            <Stepper
              className="mb-6"
              steps={steps.map((s) => ({ label: s.title }))}
              current={currentStep}
            />
            <div className="mb-6">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                <span>
                  {doneCount} of {steps.length}
                </span>
                <span>{progressPct}%</span>
              </div>
              <Progress value={doneCount} max={steps.length} />
            </div>

            <div className="space-y-3">
              {steps.map((s) => (
                <Card
                  key={s.num}
                  className={cn(
                    !s.done && !current.includes(s) && 'opacity-45',
                  )}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'flex size-6 items-center justify-center rounded-full text-[10px] font-semibold',
                            s.done
                              ? 'bg-[var(--cx-brand)] text-white'
                              : 'bg-[var(--cx-surface-3)] text-[var(--cx-text-2)]',
                          )}
                        >
                          {s.done ? <Check className="size-3.5" /> : s.num}
                        </span>
                        <CardTitle className="text-base">{s.title}</CardTitle>
                      </div>
                      <StatusPill
                        label={s.done ? 'Complete' : 'Next'}
                        tone={s.done ? 'success' : 'neutral'}
                      />
                    </div>
                    <CardDescription>{s.body}</CardDescription>
                  </CardHeader>
                  {/* Every incomplete non-final step routes to the profile edit
                      form where its fields are actually persisted. */}
                  {!s.done && s.num < steps.length ? (
                    <CardContent>
                      <Link
                        href="/dashboard/profile/edit"
                        className="flex h-10 w-full items-center justify-center rounded-full bg-[var(--cx-brand)] text-sm font-medium text-white transition hover:bg-[var(--cx-brand-strong)]"
                      >
                        {s.num === 1 ? 'Add your bio' : 'Continue'}
                      </Link>
                    </CardContent>
                  ) : null}
                  {/* Final step: completion is gated server-side by the real
                      persisted-requirement check. */}
                  {s.num === steps.length && !s.done ? (
                    <CardContent>
                      <Button
                        className="w-full"
                        disabled={completing}
                        onClick={() => void handleFinish()}
                      >
                        {completing ? 'Finishing…' : 'Finish setup'}
                      </Button>
                    </CardContent>
                  ) : null}
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
