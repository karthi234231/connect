// src/lib/dto.ts
// ─────────────────────────────────────────────────────────────────────────────
// W3.1 — Centralized DTO projections (§2.4 Web DTO Contract)
//
// Never pass raw database rows to UI surfaces. Every surface consumes a narrow,
// Zod-validated DTO that strips hidden identity, PII and private fields.
//
// Privacy rules enforced here (release blockers §7.6):
//   * ProfileSummaryDTO / EventSummaryDTO — public browse-safe, NEVER include
//     email/phone/links/precise location or hidden identity.
//   * ProfilePrivateDTO                     — owner-only.
//   * AdminUserRowDTO / ReportQueueItemDTO  — redacted unless a role policy
//     explicitly allows more.
//
// All projection functions are PURE (no I/O) so they are unit-testable and
// reusable from server components, server actions and services alike.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod'

// ─── Profile rows (source of truth mirrors `profiles` table) ────────────────

export interface ProfileRow {
  id: string
  full_name: string
  role?: string | null
  bio?: string | null
  skills?: string[] | null
  availability?: {
    days: string[]
    hours: { start: string; end: string }
  } | null
  timezone?: string | null
  looking_for?: { roles: string[] } | null
  visibility?: string | null
  commitment_level?: string | null
  work_style?: string | null
  avatar_url?: string | null
  last_active_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  onboarding_status?: string | null
  onboarding_completed_at?: string | null
  app_role?: string | null
  [key: string]: unknown
}

// ─── ProfileSummaryDTO (public / browse-safe) ────────────────────────────────
// Narrow projection for discovery lists. Deliberately excludes contact details,
// precise location and any hidden identity signal.

export const ProfileSummaryDTOSchema = z
  .object({
    id: z.string().uuid(),
    fullName: z.string(),
    role: z.string().nullable(),
    avatarUrl: z.string().url().nullable(),
    headline: z.string().nullable(), // first ~90 chars of bio
    topSkills: z.array(z.string()).max(3),
    lastActiveAt: z.string().nullable(),
  })
  .strict()

export type ProfileSummaryDTO = z.infer<typeof ProfileSummaryDTOSchema>

/** Extract a short, public-safe headline from a raw bio. */
export function toHeadline(bio?: string | null, max = 90): string | null {
  if (!bio) return null
  const trimmed = bio.trim()
  if (!trimmed) return null
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed
}

/** Project a raw profiles row into the public ProfileSummaryDTO. */
export function toProfileSummaryDTO(row: ProfileRow): ProfileSummaryDTO {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role ?? null,
    avatarUrl: row.avatar_url ?? null,
    headline: toHeadline(row.bio),
    topSkills: (row.skills ?? []).slice(0, 3),
    lastActiveAt: row.last_active_at ?? null,
  }
}

// ─── ProfilePrivateDTO (own profile) ────────────────────────────────────────
// Only ever produced for the authenticated owner. Contains the fields needed to
// edit a profile plus completeness-relevant data, never third-party PII.

export const ProfilePrivateDTOSchema = z
  .object({
    id: z.string().uuid(),
    fullName: z.string(),
    role: z.string().nullable(),
    bio: z.string().nullable(),
    skills: z.array(z.string()),
    availability: z
      .object({
        days: z.array(z.string()),
        hours: z.object({ start: z.string(), end: z.string() }),
      })
      .nullable(),
    timezone: z.string().nullable(),
    lookingFor: z.object({ roles: z.array(z.string()) }).nullable(),
    visibility: z
      .enum(['public', 'recruiting', 'private', 'stealth'])
      .nullable(),
    avatarUrl: z.string().url().nullable(),
    commitmentLevel: z.string().nullable(),
    workStyle: z.string().nullable(),
    appRole: z.enum(['user', 'admin']).nullable(),
  })
  .strict()

export type ProfilePrivateDTO = z.infer<typeof ProfilePrivateDTOSchema>

type AvailabilityShape = ProfilePrivateDTO['availability']
type LookingForShape = ProfilePrivateDTO['lookingFor']

/** Project a raw profiles row into the owner-only ProfilePrivateDTO. */
export function toProfilePrivateDTO(row: ProfileRow): ProfilePrivateDTO {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role ?? null,
    bio: row.bio ?? null,
    skills: row.skills ?? [],
    availability: row.availability
      ? (row.availability as AvailabilityShape)
      : null,
    timezone: row.timezone ?? null,
    lookingFor: row.looking_for ? (row.looking_for as LookingForShape) : null,
    visibility: (row.visibility as ProfilePrivateDTO['visibility']) ?? null,
    avatarUrl: row.avatar_url ?? null,
    commitmentLevel: (row.commitment_level as string | null) ?? null,
    workStyle: (row.work_style as string | null) ?? null,
    appRole: row.app_role === 'admin' ? 'admin' : 'user',
  }
}
