// src/app/actions/onboarding.ts
// Session 10 — onboarding wizard persistence. Each step persists ONLY its own
// section (no cross-step writes); completion runs the canonical
// pending→completed transition in the profiles service.
'use server'

import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { toErrorPayload } from '@/lib/errors'
import { logger } from '@/lib/logger'
import {
  computeOnboardingState,
  toOnboardingInputs,
} from '@/services/profiles/onboarding'
import { collaborationSchema } from '@/services/profiles/profile.schema'
import {
  applyOnboardingTransition,
  getProfile,
  updateIntroductionSection,
  updateProfile,
} from '@/services/profiles/service'

/**
 * Wire payload for one wizard step. Deliberately loose (`string[]`) so the UI
 * can hand over its selection state; the services re-validate against the
 * canonical taxonomies before anything is persisted.
 */
export type OnboardingStepPayload =
  | { step: 'linkedinIdentity' }
  | { step: 'about'; bio: string | null }
  | { step: 'lookingFor'; lookingFor: { roles: string[] } }
  | { step: 'offering'; offering: { categories: string[] } }
  | { step: 'optionalContext'; skills: string[] }
  | { step: 'discoverReady' }

export interface OnboardingActionResult {
  ok: boolean
  error: string | null
}

const skillSchema = z.string().trim().min(1).max(50)

const payloadSchema = z.discriminatedUnion('step', [
  z.object({ step: z.literal('linkedinIdentity') }).strict(),
  z
    .object({
      step: z.literal('about'),
      bio: z.string().trim().max(1000).nullable(),
    })
    .strict(),
  z
    .object({
      step: z.literal('lookingFor'),
      lookingFor: z
        .object({ roles: z.array(z.string().trim().min(1)).max(5) })
        .strict(),
    })
    .strict(),
  z
    .object({
      step: z.literal('offering'),
      offering: z
        .object({ categories: z.array(z.string().trim().min(1)).max(5) })
        .strict(),
    })
    .strict(),
  z
    .object({
      step: z.literal('optionalContext'),
      skills: z.array(skillSchema).max(20),
    })
    .strict(),
  z.object({ step: z.literal('discoverReady') }).strict(),
])

function failure(scope: string, error: unknown): OnboardingActionResult {
  logger.error(`Onboarding action failed: ${scope}`, { error })
  return { ok: false, error: toErrorPayload(error).message }
}

export async function saveOnboardingStepAction(
  payload: OnboardingStepPayload,
): Promise<OnboardingActionResult> {
  const parsed = payloadSchema.safeParse(payload)

  if (!parsed.success) {
    return { ok: false, error: toErrorPayload(parsed.error).message }
  }

  try {
    const userId = await requireUser()
    const step = parsed.data

    switch (step.step) {
      case 'about':
        await updateIntroductionSection(userId, { bio: step.bio })
        break
      case 'lookingFor':
        // Re-validate against the canonical intent taxonomy before persisting.
        await updateProfile(userId, {
          lookingFor: collaborationSchema.shape.lookingFor.parse(
            step.lookingFor,
          ),
        })
        break
      case 'offering':
        await updateProfile(userId, {
          offering: collaborationSchema.shape.offering.parse(step.offering),
        })
        break
      case 'optionalContext':
        await updateProfile(userId, { skills: step.skills })
        break
      // Identity comes from the provider session and "discoverReady" is a
      // presentation step — neither persists anything of its own.
      case 'linkedinIdentity':
      case 'discoverReady':
        break
    }

    return { ok: true, error: null }
  } catch (error) {
    return failure(parsed.data.step, error)
  }
}

export async function completeOnboardingAction(): Promise<OnboardingActionResult> {
  try {
    const userId = await requireUser()
    const profile = await getProfile(userId)

    // P0-07: derive completion from the ACTUAL persisted profile — the same
    // values the UI state machine uses. Passing empty arrays here made the
    // completion check disagree with the saved profile (a completed-eligible
    // profile could be rejected, or vice versa).
    const state = computeOnboardingState(
      toOnboardingInputs({
        identity: { fullName: profile?.fullName ?? '' },
        bio: profile?.bio ?? null,
        lookingFor: { roles: profile?.lookingFor.roles ?? [] },
        offering: { categories: profile?.offering.categories ?? [] },
        onboardingStatus:
          profile?.onboardingStatus === 'completed' ? 'completed' : 'pending',
      }),
    )

    await applyOnboardingTransition(
      userId,
      profile?.onboardingStatus === 'completed' ? 'completed' : 'pending',
      state.canComplete,
    )

    return { ok: true, error: null }
  } catch (error) {
    return failure('complete', error)
  }
}
