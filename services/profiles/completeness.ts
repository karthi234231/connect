// src/services/profiles/completeness.ts

// Profile completeness model — a first-class, pure, synchronous primitive.
// It answers "can this user browse?" vs "can this user take actions?" and
// enumerates missing fields so the UI can guide the user precisely.

// ─── Field taxonomy ──────────────────────────────────────────

export const BROWSE_FIELDS = ['fullName', 'role', 'bio'] as const

export const ACTION_REQUIRED_FIELDS = [
  'fullName',
  'role',
  'bio',
  'skills',
  'timezone',
  'availability',
  'lookingFor',
] as const

export const OPTIONAL_FIELDS = [
  'avatarUrl',
  'commitmentLevel',
  'workStyle',
  'visibility',
] as const

export type BrowseField = (typeof BROWSE_FIELDS)[number]
export type ActionRequiredField = (typeof ACTION_REQUIRED_FIELDS)[number]
export type OptionalField = (typeof OPTIONAL_FIELDS)[number]

export interface ProfileCompleteness {
  isBrowseReady: boolean
  isActionReady: boolean
  isComplete: boolean
  completionPct: number
  browseMissingFields: BrowseField[]
  actionMissingFields: ActionRequiredField[]
  optionalEmptyFields: OptionalField[]
  missingFields: string[]
}

export interface ProfileLike {
  fullName?: unknown
  role?: unknown
  bio?: unknown
  skills?: unknown
  availability?: unknown
  timezone?: unknown
  lookingFor?: unknown
  avatarUrl?: unknown
  commitmentLevel?: unknown
  workStyle?: unknown
  visibility?: unknown
}

function isPresent(value: unknown): boolean {
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

function countComplete(
  fields: readonly string[],
  profile: ProfileLike,
): number {
  return fields.reduce(
    (count, field) =>
      count + (isPresent(profile[field as keyof ProfileLike]) ? 1 : 0),
    0,
  )
}

export function computeCompleteness(profile: ProfileLike): ProfileCompleteness {
  const browseMissing = BROWSE_FIELDS.filter(
    (field) => !isPresent(profile[field]),
  )

  const actionMissing = ACTION_REQUIRED_FIELDS.filter(
    (field) => !isPresent(profile[field]),
  )

  const optionalEmpty = OPTIONAL_FIELDS.filter(
    (field) => !isPresent(profile[field]),
  )

  const allFields: readonly string[] = [
    ...ACTION_REQUIRED_FIELDS,
    ...OPTIONAL_FIELDS,
  ]

  const complete = countComplete(allFields, profile)

  const completionPct = Math.round((complete / allFields.length) * 100)

  return {
    isBrowseReady: browseMissing.length === 0,
    isActionReady: actionMissing.length === 0,
    isComplete: actionMissing.length === 0 && optionalEmpty.length === 0,
    completionPct,
    browseMissingFields: [...browseMissing],
    actionMissingFields: [...actionMissing],
    optionalEmptyFields: [...optionalEmpty],
    missingFields: [...actionMissing, ...optionalEmpty],
  }
}

export function canBrowse(profile: ProfileLike): boolean {
  return computeCompleteness(profile).isBrowseReady
}

export function canSendRequest(profile: ProfileLike): boolean {
  return computeCompleteness(profile).isActionReady
}

export function canSendMessage(profile: ProfileLike): boolean {
  return computeCompleteness(profile).isActionReady
}

export function getMissingProfileFields(profile: ProfileLike): string[] {
  return computeCompleteness(profile).missingFields
}
