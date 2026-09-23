// src/services/linkedin/profile.ts
// Capability-aware provider reads. Unsupported capabilities return an explicit
// `unsupported` state before any network call — no invented empty imports.
//
// The ONLY live LinkedIn HTTP endpoint is the identity read (`/v2/me`).
// Experience and education are NEVER fetched over HTTP: LinkedIn has no
// `/v2/experience` / `/v2/education` endpoint and no sign-in scope returns
// employment/education history (§1.1). They are present in the adapter only
// when an approved cache SUPPLIES the professional-history payloads, which
// this client validates + maps (S07 persists the resulting domain data).
import type { z } from 'zod'
import { hasCapability } from './capabilities'
import type { LinkedInApiClient } from './client'
import {
  InvalidProviderResponseError,
  ProviderRevokedError,
  ProviderUnavailableError,
} from './errors'
import { mapEducation, mapExperience, mapIdentity, mapProfile } from './mapper'
import {
  educationPayloadSchema,
  experiencePayloadSchema,
  identityPayloadSchema,
} from './schemas'
import type {
  LinkedInEducation,
  LinkedInExperience,
  LinkedInIdentity,
  LinkedInProfile,
  LinkedInProvider,
  ProviderCapabilities,
  ProviderError,
  ProviderResult,
} from './types'

/** Live LinkedIn HTTP surface — identity only (see header comment). */
export const LinkedInEndpoints = {
  identity: '/v2/me',
} as const

export interface LinkedInSuppliedData {
  /** Supplied professional-history payload from an approved cache (no HTTP source). */
  experience?: z.infer<typeof experiencePayloadSchema>
  education?: z.infer<typeof educationPayloadSchema>
}

export class LinkedInProviderClient implements LinkedInProvider {
  readonly capabilities: ProviderCapabilities
  private readonly api: LinkedInApiClient
  private readonly supplied: LinkedInSuppliedData

  constructor(
    api: LinkedInApiClient,
    capabilities: ProviderCapabilities,
    supplied: LinkedInSuppliedData = {},
  ) {
    this.api = api
    this.capabilities = capabilities
    this.supplied = supplied
  }

  async getIdentity(): Promise<ProviderResult<LinkedInIdentity>> {
    try {
      const raw = await this.api.get(LinkedInEndpoints.identity)
      const parsed = identityPayloadSchema.safeParse(raw)
      if (!parsed.success) {
        return {
          status: 'error',
          error: this.invalidResponse(parsed.error, LinkedInEndpoints.identity),
        }
      }
      return {
        status: 'ok',
        data: mapIdentity(parsed.data, this.capabilities),
      }
    } catch (err) {
      return { status: 'error', error: this.toProviderError(err) }
    }
  }

  async getProfile(): Promise<ProviderResult<LinkedInProfile>> {
    if (!hasCapability(this.capabilities, 'profile')) {
      return { status: 'unsupported', capability: 'profile' }
    }
    try {
      const raw = await this.api.get(LinkedInEndpoints.identity)
      const parsed = identityPayloadSchema.safeParse(raw)
      if (!parsed.success) {
        return {
          status: 'error',
          error: this.invalidResponse(parsed.error, LinkedInEndpoints.identity),
        }
      }
      return mapProfile(parsed.data, this.capabilities)
    } catch (err) {
      return { status: 'error', error: this.toProviderError(err) }
    }
  }

  async getExperience(): Promise<ProviderResult<LinkedInExperience>> {
    if (!hasCapability(this.capabilities, 'experience')) {
      return { status: 'unsupported', capability: 'experience' }
    }
    // No HTTP read: experience exists ONLY when the approved cache supplies it.
    // An absent supply means data-absent — never a fabricated empty import.
    const supplied = this.supplied.experience
    if (supplied === undefined) {
      return { status: 'unsupported', capability: 'experience' }
    }
    const parsed = experiencePayloadSchema.safeParse(supplied)
    if (!parsed.success) {
      return {
        status: 'error',
        error: this.invalidResponse(parsed.error, 'supplied.experience'),
      }
    }
    return mapExperience(parsed.data, this.capabilities)
  }

  async getEducation(): Promise<ProviderResult<LinkedInEducation>> {
    if (!hasCapability(this.capabilities, 'education')) {
      return { status: 'unsupported', capability: 'education' }
    }
    // No HTTP read: education exists ONLY when the approved cache supplies it.
    const supplied = this.supplied.education
    if (supplied === undefined) {
      return { status: 'unsupported', capability: 'education' }
    }
    const parsed = educationPayloadSchema.safeParse(supplied)
    if (!parsed.success) {
      return {
        status: 'error',
        error: this.invalidResponse(parsed.error, 'supplied.education'),
      }
    }
    return mapEducation(parsed.data, this.capabilities)
  }

  private toProviderError(err: unknown): ProviderError {
    if (
      err instanceof InvalidProviderResponseError ||
      err instanceof ProviderRevokedError ||
      err instanceof ProviderUnavailableError
    ) {
      return err
    }
    return new ProviderUnavailableError(
      'LinkedIn provider request failed unexpectedly',
      { cause: err instanceof Error ? err : undefined },
    )
  }

  private invalidResponse(
    zodError: z.ZodError,
    path: string,
  ): InvalidProviderResponseError {
    return new InvalidProviderResponseError(
      'LinkedIn provider response failed validation',
      { context: { path }, zodError },
    )
  }
}

export interface CreateLinkedInProviderOptions {
  api: LinkedInApiClient
  capabilities: ProviderCapabilities
  /** Approved-cache supply of professional history — never fetched over HTTP. */
  supplied?: LinkedInSuppliedData
}

export function createLinkedInProvider(
  options: CreateLinkedInProviderOptions,
): LinkedInProvider {
  return new LinkedInProviderClient(
    options.api,
    options.capabilities,
    options.supplied,
  )
}
