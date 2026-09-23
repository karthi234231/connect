// src/services/profiles/index.ts
export {
  getProfile,
  getPublicProfile,
  getProfileProjection,
  getPublicProfileProjection,
  updateProfile,
  deleteAccount,
  getAvatarUploadUrl,
  confirmAvatarUpload,
  requestExport,
  getProfileCompleteness,
  isProfileBrowseReady,
  isProfileActionReady,
  canBrowse,
  canSendRequest,
  canSendMessage,
  loadConnectProfile,
  updateIntroductionSection,
  updateCollaborationSection,
  removeAvatar,
} from './service'
export { fetchProfileEducations, mapEducationRow } from './education-read'
export type { EducationRow } from './education-read'

export type { Profile } from './mappers'
export {
  rowToViewModel,
  profileToViewModel,
  toConnectProfileViewModel,
  resolveLinkedInUrl,
  resolveLocationValue,
  buildStatuses,
} from './mappers'
export {
  profileSchema,
  profileUpdateSchema,
  draftProfileSchema,
  requiredProfileSchema,
  draftProfileUpdateSchema,
  requiredProfileUpdateSchema,
  isFieldPresent,
  introductionSchema,
  collaborationSchema,
  profilePhotoSchema,
} from './profile.schema'
export type {
  IntroductionInput,
  CollaborationInput,
  ProfilePhotoInput,
} from './profile.schema'
export type {
  ConnectProfileViewModel,
  ProfileEducationItem,
  ProfileIdentityModel,
  ProfileOwnershipModel,
  ProfileStatus,
  ProfileStatusOrigin,
  ProviderProfileStateModel,
} from './model'
export { COMMITMENT_LABELS, WORK_STYLE_LABELS } from './model'
export {
  PROFILE_FIELD_OWNER,
  USER_EDITABLE_FIELDS,
  PROVIDER_FIELDS,
  NON_USER_EDITABLE_FIELDS,
  pickUserEditable,
  pickProviderWritable,
} from './field-ownership'
export type { FieldOwner } from './field-ownership'
export type {
  ProfileInput,
  ProfileUpdateInput,
  DraftProfileInput,
  RequiredProfileInput,
  DraftProfileUpdateInput,
  RequiredProfileUpdateInput,
} from './profile.schema'
export {
  computeCompleteness,
  canBrowse as canBrowseProfile,
  canSendRequest as canSendRequestP,
  canSendMessage as canSendMessageP,
  getMissingProfileFields,
  BROWSE_FIELDS,
  ACTION_REQUIRED_FIELDS,
  OPTIONAL_FIELDS,
} from './completeness'
export type {
  ProfileCompleteness,
  BrowseField,
  ActionRequiredField,
  OptionalField,
} from './completeness'
export {
  computeOnboardingState,
  transitionOnboarding,
  ONBOARDING_REQUIREMENTS,
} from './onboarding'
export type {
  OnboardingStatus,
  OnboardingInputs,
  OnboardingState,
  OnboardingRequirement,
} from './onboarding'
export { applyOnboardingTransition } from './service'

// V10-BE-06 — canonical Looking For / Offering taxonomy (shared authority).
export {
  COLLABORATION_INTENT_VALUES,
  LOOKING_FOR_CATEGORIES,
  OFFERING_CATEGORIES,
  lookingForSchema,
  offeringSchema,
  lookingForCategorySchema,
  offeringCategorySchema,
  getIntentLabel,
  getLookingForDescription,
  getOfferingDescription,
  getLookingForCategory,
  getOfferingCategory,
} from './intent'
export type {
  CollaborationIntent,
  LookingForIntent,
  OfferingIntent,
  IntentCategoryMeta,
  LookingForInput,
  OfferingInput,
} from './intent'

// V10-BE-05 — canonical human-first profile projection + field ownership.
export {
  PROFILE_PROJECTION_COLUMNS,
  mapRowToProjection,
  mapRowToPublicProjection,
  mapRowToOwnerProjection,
  resolveAvatarOrigin,
} from './projection'
export type {
  ProfileProjection,
  OwnerProfileProjection,
  ProfileRowLike,
  ProfileIdentityProjection,
  ProfileAvailabilityProjection,
  ProfileExperienceItem,
  ProfileSharedContextItem,
  ProfileFieldOwnershipProjection,
  SharedContextSource,
  AvatarOrigin,
  FieldOriginSource,
} from './projection'
