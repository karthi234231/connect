// src/services/profiles/field-ownership.ts
// S08 (§4.1 Data Model / Ownership Contract + Session 08) — the SINGLE
// authoritative field-ownership map for the `profiles` table.
//
// Rules derived from the contract:
//   - provider-owned fields must NOT be user-editable (any forged update that
//     carries them is dropped before it can reach a DB write);
//   - user-owned fields are the ONLY fields the user edit path may persist;
//   - system-owned fields are never writable by user OR provider.
//
// pickUserEditable() is THE final server-side gate: it must run before any
// user-driven profile write. The provider write path (auth provisioning today,
// the S07 LinkedIn sync later) is deliberately the only caller allowed to
// persist provider-owned columns.

export type FieldOwner = 'user' | 'system' | 'provider'

export const PROFILE_FIELD_OWNER: Record<string, FieldOwner> = {
  // ─── system — bookkeeping/identity/account state (never user/provider writable).
  id: 'system',
  created_at: 'system',
  updated_at: 'system',
  last_active_at: 'system',
  app_role: 'system',
  suspended_at: 'system',
  onboarding_status: 'system',
  onboarding_completed_at: 'system',

  // ─── provider — professional identity supplied by the identity provider
  // (LinkedIn OIDC provisioning) and the S07 provider sync. Never user-editable.
  //
  // role decision (S08, documented per Session-08 instructions): profiles.role
  // is the Connect PROFESSIONAL-IDENTITY column (the projection exposes it as
  // `current_role`; the taxonomy founder/engineer/designer/... comes from
  // provider-derived professional data). Evidence:
  //   - §4.1 line "ownership map is incorrect because full_name, role, and
  //     avatar_url are currently marked user-owned" → role must NOT be user-owned;
  //   - Session 08 "Provider owns: ... professional identity";
  //   - it is NOT the UI/legal account role — app_role is the system role
  //     (enum `app_role`) and is classified system here;
  //   - the `role` vocabulary is ALSO user-authored as *intent* (looking_for.roles
  //     / offering.categories), but those are separate user-owned columns —
  //     only profiles.role (the single professional-identity slot) is provider-owned.
  // provider_headline/location/linked_in_identity are S07 columns (typed in
  // database.ts, migration 20260912000000) — listed here so a forged payload
  // naming them is always gated.
  full_name: 'provider',
  role: 'provider',
  avatar_url: 'provider',
  // city is provider-derived location (future city resolution from
  // provider_location); no user edit path supplies it.
  city: 'provider',
  provider_headline: 'provider', // S07 column — LinkedIn headline, read-only
  provider_location: 'provider', // S07 column (migration 20260912000000)
  provider_linked_in_identity: 'provider', // S07 column (migration 20260912000000)
  // Session 01-02 freeze: camelCase aliases for provider identity so a forged
  // payload using fullName/avatarUrl/providerHeadline (JS form shape) is gated.
  // pickUserEditable must never accept provider fields regardless of casing.
  fullName: 'provider',
  avatarUrl: 'provider',
  providerHeadline: 'provider',
  providerLocation: 'provider',
  providerLinkedInIdentity: 'provider',
  // ─── NOTE: `headline` (no prefix) IS the user-owned introduction headline
  // column (Session 03 migration); do not classify it provider. `headline`
  // is distinct from provider_headline (LinkedIn read-only).

  // ─── user — Connect's user-authored context (§4.1 user list).
  bio: 'user',
  headline: 'user',
  idea: 'user',
  skills: 'user',
  looking_for: 'user',
  offering: 'user',
  ideas: 'user',
  interests: 'user',
  availability: 'user',
  timezone: 'user',
  commitment_level: 'user',
  work_style: 'user',
  visibility: 'user',
  notification_prefs: 'user',
}

export const USER_EDITABLE_FIELDS = Object.entries(PROFILE_FIELD_OWNER)
  .filter(([, owner]) => owner === 'user')
  .map(([field]) => field)

export const PROVIDER_FIELDS = Object.entries(PROFILE_FIELD_OWNER)
  .filter(([, owner]) => owner === 'provider')
  .map(([field]) => field)

export const SYSTEM_FIELDS = Object.entries(PROFILE_FIELD_OWNER)
  .filter(([, owner]) => owner === 'system')
  .map(([field]) => field)

export const NON_USER_EDITABLE_FIELDS = Object.entries(PROFILE_FIELD_OWNER)
  .filter(([, owner]) => owner !== 'user')
  .map(([field]) => field)

/**
 * THE final server-side gate for user-driven writes. Given an arbitrary update
 * payload (e.g. a forged body), returns ONLY the user-owned keys. Provider and
 * system keys are silently dropped — they are never persisted from this path.
 */
export function pickUserEditable<TPayload extends Record<string, unknown>>(
  payload: TPayload,
): Partial<TPayload> {
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(payload)) {
    if (
      Object.prototype.hasOwnProperty.call(PROFILE_FIELD_OWNER, key) &&
      PROFILE_FIELD_OWNER[key] === 'user'
    ) {
      out[key] = value
    }
  }

  return out as Partial<TPayload>
}

/**
 * Counterpart for the provider write path: returns ONLY provider-owned keys so
 * the provider sync (auth provisioning today, S07 sync later) can persist
 * provider identity without ever touching user/system columns through this
 * helper. Provider logic must NOT call pickUserEditable().
 */
export function pickProviderWritable<TPayload extends Record<string, unknown>>(
  payload: TPayload,
): Partial<TPayload> {
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(payload)) {
    if (
      Object.prototype.hasOwnProperty.call(PROFILE_FIELD_OWNER, key) &&
      PROFILE_FIELD_OWNER[key] === 'provider'
    ) {
      out[key] = value
    }
  }

  return out as Partial<TPayload>
}
