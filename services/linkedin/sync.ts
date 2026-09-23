// src/services/linkedin/sync.ts
// S06 orchestration stub. It assembles + schema-validates the mapped-domain
// input and updates in-memory sync state; ALL persistence is deferred to the
// S07 seam (ProviderSyncPersistence). A failed fetch never erases previously
// stored data: the attempt returns a failed snapshot and persists nothing.
import { InvalidProviderResponseError, ProviderRevokedError } from './errors'
import { linkedinSyncInputSchema } from './schemas'
import type {
  LinkedInEducation,
  LinkedInExperience,
  LinkedInLocation,
  LinkedInProvider,
  ProviderCapabilities,
  ProviderError,
  ProviderSyncState,
} from './types'

export interface ProviderSyncSnapshot {
  providerUserId: string
  state: ProviderSyncState
  capabilities: ProviderCapabilities
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  failureReason: string | null
}

export interface LinkedInProfileWrite {
  fullName: string
  avatarUrl: string | null
  providerHeadline: string | null
  providerLocation: LinkedInLocation
}

export interface LinkedInSyncWrite {
  profile: LinkedInProfileWrite
  // null = capability unsupported / data absent — S07 must NOT erase existing rows.
  experience: LinkedInExperience | null
  education: LinkedInEducation | null
}

/**
 * S07 SEAM — the persistence boundary. S06 only builds + validates the write;
 * S07 implements this against the provider_connections / profile_experiences
 * tables (RLS, upserts, ownership constraints) with sync-transaction semantics.
 */
export interface ProviderSyncPersistence {
  persist(payload: {
    providerUserId: string
    write: LinkedInSyncWrite
    syncedAt: string
  }): Promise<void>
}

export interface SyncOptions {
  provider: LinkedInProvider
  memberId: string
  persistence: ProviderSyncPersistence
  now?: () => string
}

export function classifySyncResult(error: ProviderError): ProviderSyncState {
  return error instanceof ProviderRevokedError
    ? 'provider_revoked'
    : 'retryable_error'
}

export async function syncLinkedInProvider(
  options: SyncOptions,
): Promise<ProviderSyncSnapshot> {
  const now = options.now ? options.now() : new Date().toISOString()
  const snapshot: ProviderSyncSnapshot = {
    providerUserId: options.memberId,
    state: 'syncing',
    capabilities: options.provider.capabilities,
    lastAttemptAt: now,
    lastSuccessAt: null,
    failureReason: null,
  }

  const identity = await options.provider.getIdentity()
  if (identity.status !== 'ok') {
    return fail(
      snapshot,
      identity.status === 'error'
        ? identity.error
        : new InvalidProviderResponseError(
            'LinkedIn identity capability is unsupported',
          ),
      now,
    )
  }

  const profile = await options.provider.getProfile()
  const experience = await options.provider.getExperience()
  const education = await options.provider.getEducation()

  // Fail-whole on any provider error: a transient failure must never invent
  // empty professional data or wipe previously-stored rows.
  for (const result of [profile, experience, education]) {
    if (result.status === 'error') return fail(snapshot, result.error, now)
  }

  const parsed = linkedinSyncInputSchema.safeParse({
    providerUserId: options.memberId,
    identity: identity.data,
    profile: profile.status === 'ok' ? profile.data : null,
    experience: experience.status === 'ok' ? experience.data : null,
    education: education.status === 'ok' ? education.data : null,
  })
  if (!parsed.success) {
    return fail(
      snapshot,
      new InvalidProviderResponseError(
        'Assembled LinkedIn sync input failed validation',
        {
          context: { providerUserId: options.memberId },
          zodError: parsed.error,
        },
      ),
      now,
    )
  }

  const write: LinkedInSyncWrite = {
    profile: {
      fullName: parsed.data.identity.fullName,
      avatarUrl: parsed.data.identity.avatarUrl,
      providerHeadline: parsed.data.profile?.headline ?? null,
      providerLocation: parsed.data.profile?.location ?? null,
    },
    experience: parsed.data.experience,
    education: parsed.data.education,
  }

  await options.persistence.persist({
    providerUserId: options.memberId,
    write,
    syncedAt: now,
  })

  return {
    ...snapshot,
    state: 'synced',
    lastSuccessAt: now,
    failureReason: null,
  }
}

function fail(
  snapshot: ProviderSyncSnapshot,
  error: ProviderError,
  now: string,
): ProviderSyncSnapshot {
  return {
    ...snapshot,
    state: classifySyncResult(error),
    lastAttemptAt: now,
    failureReason: error.message,
  }
}
