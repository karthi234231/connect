// src/services/profiles/profile.schema.ts
// S09 — the profile input model is split into THREE trust-boundary shapes
// instead of one giant schema. Each shape owns a distinct field set:
//
//   ProviderIdentityInput    → provider-owned professional identity (fullName,
//                              role, avatarUrl, headline, location). Used ONLY
//                              by the provider write path (auth provisioning,
//                              S07 LinkedIn sync) — never user-facing edit forms.
//   ConnectContextInput      → user-owned profile context (bio/about, skills,
//                              interests, lookingFor, offering, availability,
//                              commitmentLevel, workStyle, timezone).
//   ProfilePreferencesInput  → user-owned visibility + preferences/settings.
//
// The legacy aggregate schemas (profileSchema / profileUpdateSchema /
// draftProfileSchema / requiredProfileSchema + update variants) keep their
// historical field sets AND semantics by DELEGATING field validators to the
// three parts — so existing S08 consumers (service.ts, update actions) and
// S10/S12 (onboarding, edit form) all read from one canonical validator set.
// Validation covers: length caps, moderation (denylist), normalization
// (trim / case / dedupe), taxonomy (lookingFor/offering via the canonical
// categories), real IANA timezones, and URL checks only where a URL is stored.

import { z } from 'zod'
import {
  roleSchema,
  availabilitySchema,
  profileVisibilitySchema,
  nameSchema,
  nonEmptyStringSchema,
  urlSchema,
  timezoneSchema,
  interestsSchema,
  normalizedTagListSchema,
} from '@/lib/validation'
import {
  lookingForSchema,
  offeringSchema,
  lookingForCategorySchema,
  offeringCategorySchema,
} from './intent'
import { containsDenylisted } from '@/lib/moderation/denylist'

const bioSchema = nonEmptyStringSchema
  .max(500, 'Bio must be at most 500 characters')
  .refine((value) => !containsDenylisted(value), {
    message: 'Bio contains inappropriate language.',
  })

// #102 — canonical skill keys at ingestion: trimmed + lowercased + deduped,
// so ranking never re-normalizes per request and "React"/"react" match.
const skillsSchema = normalizedTagListSchema({ max: 20, label: 'skills' })

export const commitmentLevelSchema = z.enum([
  'exploring',
  'nights_weekends',
  'part_time',
  'full_time',
])

export const workStyleSchema = z.enum([
  'structured',
  'flexible',
  'fast_iterate',
  'deliberate',
])

// ─── S09 part 1: ProviderIdentityInput ─────────────────────
// Provider-owned professional identity, strict at the provider boundary so
// unknown/system keys are rejected before they can reach a provider write.
// role is OPTIONAL because profiles.role is a nullable column — a provider may
// lack a derived role; fullName is the one identity field every provider write
// must carry. headline/location are the S07 columns (provider_headline /
// provider_location, typed in database.ts); they are validated but only
// written by the provider write path. Never modeled in any user-edit schema
// below.
const headlineSchema = nonEmptyStringSchema
  .max(140, 'Headline must be at most 140 characters')
  .refine((value) => !containsDenylisted(value), {
    message: 'Headline contains inappropriate language.',
  })

const locationSchema = z
  .string()
  .trim()
  .min(1, 'Location is required.')
  .max(100, 'Location must not exceed 100 characters.')
  .refine((value) => !containsDenylisted(value), {
    message: 'Location contains inappropriate language.',
  })

export const providerIdentitySchema = z
  .object({
    fullName: nameSchema,
    role: roleSchema.optional(),
    avatarUrl: urlSchema.optional(),
    headline: headlineSchema.optional(),
    location: locationSchema.optional(),
  })
  .strict()

export type ProviderIdentityInput = z.infer<typeof providerIdentitySchema>

// ─── S09 part 2: ConnectContextInput ───────────────────────
// User-owned profile context, strict so provider/system keys never belong
// here. offering/commitmentLevel/workStyle stay optional — missing intent is
// not a negative judgment (see intent.ts) and the settings are genuinely
// optional. timezone is IANA-validated internally (real Intl round-trip).
export const socialLinksSchema = z
  .object({
    github: z.string().trim().max(250).optional().nullable(),
    linkedin: z.string().trim().max(250).optional().nullable(),
    twitter: z.string().trim().max(250).optional().nullable(),
    portfolio: z.string().trim().max(250).optional().nullable(),
  })
  .partial()

export type SocialLinksInput = z.infer<typeof socialLinksSchema>

export const connectContextSchema = z
  .object({
    bio: bioSchema,
    skills: skillsSchema,
    interests: interestsSchema,
    lookingFor: lookingForSchema,
    offering: offeringSchema.optional(),
    availability: availabilitySchema,
    commitmentLevel: commitmentLevelSchema.optional(),
    workStyle: workStyleSchema.optional(),
    timezone: timezoneSchema,
    socialLinks: socialLinksSchema.optional(),
  })
  .strict()

export type ConnectContextInput = z.infer<typeof connectContextSchema>

// ─── S09 part 3: ProfilePreferencesInput ───────────────────
// User-owned visibility + preferences/settings. notificationPrefs mirrors the
// profiles.notification_prefs Json (Record<string, boolean>, see projection);
// both fields are user-owned under S08 (§4.1).
export const profilePreferencesSchema = z
  .object({
    visibility: profileVisibilitySchema,
    notificationPrefs: z.record(z.string(), z.boolean()).optional(),
  })
  .strict()

export type ProfilePreferencesInput = z.infer<typeof profilePreferencesSchema>

// ─── Legacy aggregate: full profile create shape ───────────
// Byte-compatible with the historical contract: strict, with fullName/role/
// bio/skills/availability/timezone/lookingFor required, visibility defaulting
// to "public", avatarUrl/commitmentLevel/workStyle/offering optional. Visible
// fields delegate to the three S09 parts; interests stays OUT (not part of the
// legacy shape — ConnectContextInput is the canonical shape that includes it).
export const profileSchema = z
  .object({
    fullName: providerIdentitySchema.shape.fullName,
    role: roleSchema,
    bio: connectContextSchema.shape.bio,
    skills: connectContextSchema.shape.skills,
    availability: connectContextSchema.shape.availability,
    timezone: connectContextSchema.shape.timezone,
    lookingFor: connectContextSchema.shape.lookingFor,
    visibility: profilePreferencesSchema.shape.visibility.default('public'),
    avatarUrl: providerIdentitySchema.shape.avatarUrl,
    commitmentLevel: connectContextSchema.shape.commitmentLevel,
    workStyle: connectContextSchema.shape.workStyle,
    offering: connectContextSchema.shape.offering,
    socialLinks: socialLinksSchema.optional(),
  })
  .strict()

export type ProfileInput = z.infer<typeof profileSchema>

// S08 (§4.1) — the user-edit boundary accepts ONLY user-owned fields.
// Provider-owned identity keys (fullName, role, avatarUrl, headline, location)
// are deliberately NOT modeled here: unknown keys are STRIPPED (no .strict()),
// so a forged provider/system key in an update payload is silently dropped and
// can never reach a DB write through the user path. pickUserEditable() in
// field-ownership.ts re-checks every mapped update as the final server-side
// gate. The dedicated provider write path (auth provisioning, S07 LinkedIn
// sync) persists provider columns via ProviderIdentityInput — its own payload.
// The full-shape schemas (profileSchema / draftProfileSchema /
// requiredProfileSchema) stay for full-profile/onboarding shape validation;
// S09 splits the model into ProviderIdentityInput / ConnectContextInput /
// ProfilePreferencesInput, and profileUpdateSchema is derived from the
// user-owned parts (ConnectContextInput + ProfilePreferencesInput visibility).
// Note: no `visibility` default here — a partial update persists only the
// fields the caller actually sent.
const profileUserEditableFields = z.object({
  bio: connectContextSchema.shape.bio,
  skills: connectContextSchema.shape.skills,
  availability: connectContextSchema.shape.availability,
  timezone: connectContextSchema.shape.timezone,
  lookingFor: connectContextSchema.shape.lookingFor,
  visibility: profilePreferencesSchema.shape.visibility,
  commitmentLevel: connectContextSchema.shape.commitmentLevel,
  workStyle: connectContextSchema.shape.workStyle,
  offering: connectContextSchema.shape.offering,
  socialLinks: socialLinksSchema.optional(),
})

export const profileUpdateSchema = profileUserEditableFields.partial()

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>

// The settings/profile surface edits ONLY the introduction section (headline,
// bio, idea) through updateIntroductionSection — it deliberately cannot touch
// collaboration, preferences or identity columns. The section schema is the
// single authority for that surface (no ad-hoc `{ bio }` object anywhere).

// ─── Session 01-02 — frozen section schemas (new flow) ─────────────────────
// These sit alongside the legacy aggregates — they are the section-level
// validators the new editors will use. Commitment/work-style/skills/
// availability/timezone/visibility/interests/story/provider-location/media/
// context are NOT modeled here; they are legacy and intentionally absent from
// this frozen contract. Reuses existing tokens (urlSchema, denylist, canonical
// taxonomy from intent.ts).

const introductionHeadlineSchema = z
  .string()
  .trim()
  .max(120, 'Headline must be at most 120 characters')
  .refine((value) => !containsDenylisted(value), {
    message: 'Headline contains inappropriate language.',
  })

const ideaSchema = z
  .string()
  .trim()
  .max(300, 'Idea must be at most 300 characters')
  .refine((value) => !containsDenylisted(value), {
    message: 'Idea contains inappropriate language.',
  })

/**
 * Introduction section: headline (max 120) + bio (max 500, via connectContext)
 * + idea (max 300). All three are optional at the section boundary — the view
 * model exposes them as nullable — but when present they are validated.
 */
export const introductionSchema = z
  .object({
    headline: introductionHeadlineSchema.optional().nullable(),
    bio: connectContextSchema.shape.bio.optional().nullable(),
    idea: ideaSchema.optional().nullable(),
  })
  .strict()

export type IntroductionInput = z.infer<typeof introductionSchema>

/**
 * Collaboration section: offering + lookingFor, each capped at 5 intents and
 * validated against the canonical taxonomy (intent.ts — single authority).
 */
export const collaborationSchema = z
  .object({
    offering: z
      .object({
        categories: z
          .array(offeringCategorySchema)
          .max(5, 'Offering must have at most 5 intents'),
      })
      .strict(),
    lookingFor: z
      .object({
        roles: z
          .array(lookingForCategorySchema)
          .max(5, 'Looking for must have at most 5 intents'),
      })
      .strict(),
  })
  .strict()

export type CollaborationInput = z.infer<typeof collaborationSchema>

/** Profile photo section — validates an avatar reference (URL or null). */
export const profilePhotoSchema = z
  .object({
    avatarUrl: urlSchema.nullable().optional(),
  })
  .strict()

export type ProfilePhotoInput = z.infer<typeof profilePhotoSchema>

// Draft = any subset allowed while the form is incomplete. Same delegated
// validators as the full shapes, but every field except fullName is optional,
// and the draft timezone stays a loose trimmed string (a half-typed zone must
// still save as a draft).
export const draftProfileSchema = z
  .object({
    fullName: providerIdentitySchema.shape.fullName,
    role: providerIdentitySchema.shape.role,
    bio: connectContextSchema.shape.bio.optional(),
    skills: connectContextSchema.shape.skills.optional(),
    availability: connectContextSchema.shape.availability.optional(),
    timezone: z.string().trim().optional(),
    lookingFor: connectContextSchema.shape.lookingFor.optional(),
    visibility: profilePreferencesSchema.shape.visibility.optional(),
    avatarUrl: providerIdentitySchema.shape.avatarUrl.optional(),
    commitmentLevel: connectContextSchema.shape.commitmentLevel.optional(),
    workStyle: connectContextSchema.shape.workStyle.optional(),
    offering: connectContextSchema.shape.offering.optional(),
  })
  .strict()

export type DraftProfileInput = z.infer<typeof draftProfileSchema>

// Minimum profile required to be action-ready (fullName/role/bio/skills/
// availability/timezone/lookingFor) — the strict subset of the split model.
export const requiredProfileSchema = z
  .object({
    fullName: providerIdentitySchema.shape.fullName,
    role: roleSchema,
    bio: connectContextSchema.shape.bio,
    skills: connectContextSchema.shape.skills,
    availability: connectContextSchema.shape.availability,
    timezone: connectContextSchema.shape.timezone,
    lookingFor: connectContextSchema.shape.lookingFor,
  })
  .strict()

export type RequiredProfileInput = z.infer<typeof requiredProfileSchema>

export const draftProfileUpdateSchema = draftProfileSchema.partial().strict()

export type DraftProfileUpdateInput = z.infer<typeof draftProfileUpdateSchema>

export const requiredProfileUpdateSchema = requiredProfileSchema
  .partial()
  .strict()

export type RequiredProfileUpdateInput = z.infer<
  typeof requiredProfileUpdateSchema
>

export function isFieldPresent(
  input: Record<string, unknown>,
  key: string,
): boolean {
  const value = input[key]

  if (value === undefined || value === null) {
    return false
  }

  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0
  }

  return true
}
