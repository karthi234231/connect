// src/services/linkedin/mapper.ts
// Pure mapping from validated provider payloads to domain data. No I/O.
// Capability-gated: mapProfile / mapExperience / mapEducation return an
// explicit `unsupported` state instead of inventing empty professional data.
import type { z } from 'zod'
import { hasCapability } from './capabilities'
import type {
  educationElementPayloadSchema,
  experienceElementPayloadSchema,
  identityPayloadSchema,
} from './schemas'
import type {
  LinkedInCapability,
  LinkedInEducation,
  LinkedInExperience,
  LinkedInIdentity,
  LinkedInProfile,
  ProviderCapabilities,
} from './types'

type IdentityPayload = z.infer<typeof identityPayloadSchema>
type ExperienceElementPayload = z.infer<typeof experienceElementPayloadSchema>
type EducationElementPayload = z.infer<typeof educationElementPayloadSchema>

export type MapperResult<T> =
  | { status: 'ok'; data: T }
  | {
      status: 'unsupported'
      capability: Exclude<LinkedInCapability, 'identity'>
    }

export function mapIdentity(
  raw: IdentityPayload,
  _capabilities: ProviderCapabilities,
): LinkedInIdentity {
  return {
    providerUserId: raw.id,
    sub: raw.sub ?? null,
    firstName: raw.localizedFirstName,
    lastName: raw.localizedLastName,
    fullName: `${raw.localizedFirstName} ${raw.localizedLastName}`,
    email: raw.email ?? null,
    emailVerified: raw.email_verified ?? null,
    avatarUrl: raw.picture ?? null,
  }
}

export function mapProfile(
  raw: IdentityPayload,
  capabilities: ProviderCapabilities,
): MapperResult<LinkedInProfile> {
  if (!hasCapability(capabilities, 'profile')) {
    return { status: 'unsupported', capability: 'profile' }
  }
  return {
    status: 'ok',
    data: {
      headline: raw.headline ?? null,
      location: raw.location
        ? {
            countryCode: raw.location.countryCode ?? null,
            localizedName: raw.location.localizedName ?? null,
          }
        : null,
    },
  }
}

export function mapExperience(
  items: ExperienceElementPayload[],
  capabilities: ProviderCapabilities,
): MapperResult<LinkedInExperience> {
  if (!hasCapability(capabilities, 'experience')) {
    return { status: 'unsupported', capability: 'experience' }
  }
  return { status: 'ok', data: items.map(mapExperienceItem) }
}

export function mapEducation(
  items: EducationElementPayload[],
  capabilities: ProviderCapabilities,
): MapperResult<LinkedInEducation> {
  if (!hasCapability(capabilities, 'education')) {
    return { status: 'unsupported', capability: 'education' }
  }
  return { status: 'ok', data: items.map(mapEducationItem) }
}

function mapExperienceItem(
  raw: ExperienceElementPayload,
): LinkedInExperience[number] {
  // A position without an end date is a current role (LinkedIn convention).
  const current = raw.current === true || raw.end == null
  return {
    providerId: raw.id ?? null,
    title: raw.title,
    companyName: raw.companyName,
    locationName: raw.locationName ?? null,
    start: raw.start
      ? { year: raw.start.year ?? null, month: raw.start.month ?? null }
      : null,
    end: current
      ? null
      : raw.end
        ? { year: raw.end.year ?? null, month: raw.end.month ?? null }
        : null,
    current,
    source: 'linkedin',
  }
}

function mapEducationItem(
  raw: EducationElementPayload,
): LinkedInEducation[number] {
  return {
    providerId: raw.id ?? null,
    schoolName: raw.schoolName,
    degreeName: raw.degreeName ?? null,
    fieldOfStudy: raw.fieldOfStudy ?? null,
    start: raw.start ? { year: raw.start.year ?? null } : null,
    end: raw.end ? { year: raw.end.year ?? null } : null,
    source: 'linkedin',
  }
}
