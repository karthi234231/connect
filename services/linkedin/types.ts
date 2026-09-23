// src/services/linkedin/types.ts
// Provider domain types. LinkedInIdentity / LinkedInProfile / LinkedInExperience
// / LinkedInEducation are inferred from the domain schemas so the validation
// and the types can never drift. Capability-aware results are explicit: an
// unsupported endpoint returns an `unsupported` state, a failed fetch returns
// an `error` state — nothing silently fabricates professional data.
import type { z } from 'zod'
import {
  linkedinEducationListSchema,
  linkedinExperienceListSchema,
  linkedinIdentitySchema,
  linkedinProfileSchema,
} from './schemas'
import type {
  InvalidProviderResponseError,
  ProviderRevokedError,
  ProviderUnavailableError,
} from './errors'

export type LinkedInIdentity = z.infer<typeof linkedinIdentitySchema>
export type LinkedInProfile = z.infer<typeof linkedinProfileSchema>
/** LinkedInExperience = the provider's experience list (S07 upserts these). */
export type LinkedInExperience = z.infer<typeof linkedinExperienceListSchema>
export type LinkedInEducation = z.infer<typeof linkedinEducationListSchema>
export type LinkedInLocation = LinkedInProfile['location']

export type LinkedInCapability =
  'identity' | 'profile' | 'experience' | 'education'

export type ProviderCapabilities = Readonly<Record<LinkedInCapability, boolean>>

export type ProviderSyncState =
  | 'never_synced'
  | 'syncing'
  | 'synced'
  | 'stale'
  | 'retryable_error'
  | 'provider_revoked'
  | 'unsupported'

export type ProviderError =
  ProviderUnavailableError | ProviderRevokedError | InvalidProviderResponseError

export type ProviderResult<T> =
  | { status: 'ok'; data: T }
  | {
      status: 'unsupported'
      capability: Exclude<LinkedInCapability, 'identity'>
    }
  | { status: 'error'; error: ProviderError }

export interface LinkedInProvider {
  readonly capabilities: ProviderCapabilities
  getIdentity(): Promise<ProviderResult<LinkedInIdentity>>
  getProfile(): Promise<ProviderResult<LinkedInProfile>>
  getExperience(): Promise<ProviderResult<LinkedInExperience>>
  getEducation(): Promise<ProviderResult<LinkedInEducation>>
}
