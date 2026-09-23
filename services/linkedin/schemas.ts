// src/services/linkedin/schemas.ts
// Canonical LinkedIn provider validation, two layers:
//   - payload schemas: validate the normalized payloads the adapter receives.
//     The ONLY live LinkedIn response here is the OIDC identity payload
//     (`/v2/me`-shaped, which with a real profile scope may also carry
//     headline/location). Experience/education payloads are NEVER a LinkedIn
//     HTTP response — no such endpoint exists; they validate *supplied*
//     professional history handed to the adapter from an approved cache
//     (product contract §1.1), which is also the S07 persistence source.
//   - domain schemas: validate the enriched domain data handed to S07.
import { z } from 'zod'

const providerId = z.string().trim().min(1)

// ─── Payload schemas ─────────────────────────────────────────

export const identityPayloadSchema = z.object({
  id: providerId,
  localizedFirstName: z.string().trim().min(1),
  localizedLastName: z.string().trim().min(1),
  sub: z.string().trim().min(1).optional().nullable(),
  email: z.email().optional().nullable(),
  email_verified: z.boolean().optional().nullable(),
  picture: z.string().trim().min(1).optional().nullable(),
  headline: z.string().trim().max(500).optional().nullable(),
  location: z
    .object({
      countryCode: z.string().trim().min(1).optional().nullable(),
      localizedName: z.string().trim().min(1).optional().nullable(),
    })
    .optional()
    .nullable(),
})

const payloadDate = z.object({
  year: z.number().int().min(1500).max(2200).optional().nullable(),
  month: z.number().int().min(1).max(12).optional().nullable(),
})

// ─── Supplied professional-history payload schemas ────────────────────────
// LinkedIn has NO `/v2/experience` or `/v2/education` HTTP endpoint, and no
// sign-in scope can return employment/education history (§1.1). These schemas
// validate the SUPPLIED payload shape produced by an approved cache/import
// pipeline — never a live LinkedIn API response.

export const experienceElementPayloadSchema = z.object({
  id: z.string().trim().min(1).optional().nullable(),
  title: z.string().trim().min(1),
  companyName: z.string().trim().min(1),
  locationName: z.string().trim().min(1).optional().nullable(),
  start: payloadDate.optional().nullable(),
  end: payloadDate.optional().nullable(),
  current: z.boolean().optional(),
})

export const experiencePayloadSchema = z.array(experienceElementPayloadSchema)

const payloadYear = z.object({
  year: z.number().int().min(1500).max(2200).optional().nullable(),
})

export const educationElementPayloadSchema = z.object({
  id: z.string().trim().min(1).optional().nullable(),
  schoolName: z.string().trim().min(1),
  degreeName: z.string().trim().min(1).optional().nullable(),
  fieldOfStudy: z.string().trim().min(1).optional().nullable(),
  start: payloadYear.optional().nullable(),
  end: payloadYear.optional().nullable(),
})

export const educationPayloadSchema = z.array(educationElementPayloadSchema)

// ─── Domain schemas (validated input for the S07 persistence seam) ───

export const linkedinIdentitySchema = z.object({
  providerUserId: providerId,
  sub: z.string().nullable(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  fullName: z.string().trim().min(1),
  email: z.string().nullable(),
  emailVerified: z.boolean().nullable(),
  avatarUrl: z.string().nullable(),
})

export const linkedinProfileSchema = z.object({
  headline: z.string().nullable(),
  location: z
    .object({
      countryCode: z.string().nullable(),
      localizedName: z.string().nullable(),
    })
    .nullable(),
})

const linkedinDateSchema = z.object({
  year: z.number().nullable(),
  month: z.number().nullable(),
})

export const linkedinExperienceItemSchema = z.object({
  providerId: z.string().nullable(),
  title: z.string().trim().min(1),
  companyName: z.string().trim().min(1),
  locationName: z.string().nullable(),
  start: linkedinDateSchema.nullable(),
  end: linkedinDateSchema.nullable(),
  current: z.boolean(),
  source: z.literal('linkedin'),
})

export const linkedinExperienceListSchema = z.array(
  linkedinExperienceItemSchema,
)

export const linkedinEducationItemSchema = z.object({
  providerId: z.string().nullable(),
  schoolName: z.string().trim().min(1),
  degreeName: z.string().nullable(),
  fieldOfStudy: z.string().nullable(),
  start: z.object({ year: z.number().nullable() }).nullable(),
  end: z.object({ year: z.number().nullable() }).nullable(),
  source: z.literal('linkedin'),
})

export const linkedinEducationListSchema = z.array(linkedinEducationItemSchema)

export const linkedinSyncInputSchema = z.object({
  providerUserId: providerId,
  identity: linkedinIdentitySchema,
  // null = capability unsupported or data absent — never an invented empty import.
  profile: linkedinProfileSchema.nullable(),
  experience: linkedinExperienceListSchema.nullable(),
  education: linkedinEducationListSchema.nullable(),
})
