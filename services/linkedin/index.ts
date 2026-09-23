// src/services/linkedin/index.ts
// S06 — LinkedIn provider adapter public surface.

export {
  LINKEDIN_PROFILE_SCOPE,
  NO_PROVIDER_DATA_SUPPLY,
  PRODUCT_AUTHORIZED_SCOPES,
  RECONCILABLE_SCOPES,
  hasCapability,
  resolveCapabilities,
} from './capabilities'
export type { ProviderDataSupply } from './capabilities'

export {
  InvalidProviderResponseError,
  ProviderRevokedError,
  ProviderUnavailableError,
} from './errors'
export type { ProviderValidationIssue } from './errors'

export { LinkedInApiClient } from './client'
export type { AccessTokenProvider, LinkedInClientOptions } from './client'

export {
  educationElementPayloadSchema,
  educationPayloadSchema,
  experienceElementPayloadSchema,
  experiencePayloadSchema,
  identityPayloadSchema,
  linkedinEducationItemSchema,
  linkedinEducationListSchema,
  linkedinExperienceItemSchema,
  linkedinExperienceListSchema,
  linkedinIdentitySchema,
  linkedinProfileSchema,
  linkedinSyncInputSchema,
} from './schemas'

export { mapEducation, mapExperience, mapIdentity, mapProfile } from './mapper'
export type { MapperResult } from './mapper'

export {
  LinkedInEndpoints,
  LinkedInProviderClient,
  createLinkedInProvider,
} from './profile'
export type {
  CreateLinkedInProviderOptions,
  LinkedInSuppliedData,
} from './profile'

export {
  capabilitiesForSession,
  extractProviderAccessToken,
  extractProviderMemberId,
  grantedScopesFor,
  sessionAccessTokenProvider,
} from './auth'
export type {
  LinkedInAuthUserLike,
  LinkedInSessionProviderIdentity,
} from './auth'

export { classifySyncResult, syncLinkedInProvider } from './sync'
export type {
  LinkedInProfileWrite,
  LinkedInSyncWrite,
  ProviderSyncPersistence,
  ProviderSyncSnapshot,
  SyncOptions,
} from './sync'

export type {
  LinkedInCapability,
  LinkedInEducation,
  LinkedInExperience,
  LinkedInIdentity,
  LinkedInLocation,
  LinkedInProfile,
  LinkedInProvider,
  ProviderCapabilities,
  ProviderError,
  ProviderResult,
  ProviderSyncState,
} from './types'
