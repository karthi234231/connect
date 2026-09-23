// src/lib/messages.ts
//
// CONNECT — Canonical application messages.
// Single source of truth for:
// - error codes
// - user-facing error messages
// - validation messages
// - success messages
// - information messages
// - authentication/onboarding gates
// - discovery/matching/chat/ideas/events/profile states
// - empty/loading/offline states
// - accessibility announcements
//
// IMPORTANT:
// 1. Technical/internal errors MUST NOT be shown directly to users.
// 2. Server logs may contain technical details; UI receives safe messages.
// 3. Do not create duplicate message constants elsewhere.
// 4. Keep product wording here so UX copy remains consistent.
// 5. Do not put dynamic IDs/user data directly into user-facing strings.
//    Use the interpolation helpers at the bottom where required.

export const ERROR_CODES = {
  // Authentication / identity
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_SESSION_INVALID: 'AUTH_SESSION_INVALID',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_PROVIDER_FAILED: 'AUTH_PROVIDER_FAILED',
  AUTH_CALLBACK_FAILED: 'AUTH_CALLBACK_FAILED',
  AUTH_IDENTITY_NOT_FOUND: 'AUTH_IDENTITY_NOT_FOUND',
  AUTH_IDENTITY_CONFLICT: 'AUTH_IDENTITY_CONFLICT',

  // Onboarding
  ONBOARDING_REQUIRED: 'ONBOARDING_REQUIRED',
  ONBOARDING_INCOMPLETE: 'ONBOARDING_INCOMPLETE',
  ONBOARDING_ALREADY_COMPLETED: 'ONBOARDING_ALREADY_COMPLETED',

  // Authorization / access
  FORBIDDEN: 'FORBIDDEN',
  CAPABILITY_DENIED: 'CAPABILITY_DENIED',
  RESOURCE_FORBIDDEN: 'RESOURCE_FORBIDDEN',
  RESOURCE_PRIVATE: 'RESOURCE_PRIVATE',
  BLOCKED: 'BLOCKED',

  // Validation
  VALIDATION: 'VALIDATION',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_ID: 'INVALID_ID',
  INVALID_ACTION: 'INVALID_ACTION',
  INVALID_STATE: 'INVALID_STATE',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  IDEA_NOT_FOUND: 'IDEA_NOT_FOUND',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  MATCH_NOT_FOUND: 'MATCH_NOT_FOUND',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',

  // Conflicts / duplicate operations
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  ALREADY_MATCHED: 'ALREADY_MATCHED',
  ALREADY_VALIDATED: 'ALREADY_VALIDATED',
  ALREADY_SPARKED: 'ALREADY_SPARKED',
  ALREADY_JOINED: 'ALREADY_JOINED',
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  ALREADY_BLOCKED: 'ALREADY_BLOCKED',

  // Rate limits / abuse
  RATE_LIMITED: 'RATE_LIMITED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  ACTION_COOLDOWN: 'ACTION_COOLDOWN',

  // Network / infrastructure
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE',
  STORAGE_ERROR: 'STORAGE_ERROR',
  REALTIME_ERROR: 'REALTIME_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL: 'INTERNAL',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/**
 * HTTP status mapping.
 * Keep transport status separate from user-facing copy.
 */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  AUTH_REQUIRED: 401,
  AUTH_SESSION_INVALID: 401,
  AUTH_SESSION_EXPIRED: 401,
  AUTH_PROVIDER_FAILED: 502,
  AUTH_CALLBACK_FAILED: 502,
  AUTH_IDENTITY_NOT_FOUND: 404,
  AUTH_IDENTITY_CONFLICT: 409,

  ONBOARDING_REQUIRED: 403,
  ONBOARDING_INCOMPLETE: 403,
  ONBOARDING_ALREADY_COMPLETED: 409,

  FORBIDDEN: 403,
  CAPABILITY_DENIED: 403,
  RESOURCE_FORBIDDEN: 403,
  RESOURCE_PRIVATE: 403,
  BLOCKED: 403,

  VALIDATION: 400,
  REQUIRED_FIELD: 400,
  INVALID_INPUT: 400,
  INVALID_FORMAT: 400,
  INVALID_ID: 400,
  INVALID_ACTION: 400,
  INVALID_STATE: 409,

  NOT_FOUND: 404,
  PROFILE_NOT_FOUND: 404,
  IDEA_NOT_FOUND: 404,
  EVENT_NOT_FOUND: 404,
  MATCH_NOT_FOUND: 404,
  CONVERSATION_NOT_FOUND: 404,
  MESSAGE_NOT_FOUND: 404,

  CONFLICT: 409,
  ALREADY_EXISTS: 409,
  ALREADY_MATCHED: 409,
  ALREADY_VALIDATED: 409,
  ALREADY_SPARKED: 409,
  ALREADY_JOINED: 409,
  ALREADY_REGISTERED: 409,
  ALREADY_BLOCKED: 409,

  RATE_LIMITED: 429,
  TOO_MANY_REQUESTS: 429,
  ACTION_COOLDOWN: 429,

  NETWORK: 503,
  TIMEOUT: 504,
  SERVICE_UNAVAILABLE: 503,
  EXTERNAL_SERVICE: 503,
  STORAGE_ERROR: 503,
  REALTIME_ERROR: 503,
  DATABASE_ERROR: 503,
  INTERNAL: 500,
}

/**
 * Safe user-facing error messages.
 *
 * These MUST NOT expose:
 * - database errors
 * - SQL
 * - provider tokens
 * - internal IDs
 * - stack traces
 * - infrastructure details
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Please sign in with LinkedIn to continue.',
  AUTH_REQUIRED: 'Sign in with LinkedIn to continue.',
  AUTH_SESSION_INVALID:
    'Your session could not be verified. Please sign in again.',
  AUTH_SESSION_EXPIRED:
    'Your session is no longer active. Please sign in again.',
  AUTH_PROVIDER_FAILED:
    'LinkedIn sign-in is temporarily unavailable. Please try again.',
  AUTH_CALLBACK_FAILED:
    "We couldn't complete LinkedIn sign-in. Please try again.",
  AUTH_IDENTITY_NOT_FOUND: "We couldn't find your Connect account.",
  AUTH_IDENTITY_CONFLICT:
    'This LinkedIn account is already linked to another Connect account.',

  ONBOARDING_REQUIRED: 'Complete your profile setup to continue.',
  ONBOARDING_INCOMPLETE: 'Finish your profile setup to continue.',
  ONBOARDING_ALREADY_COMPLETED: 'Your profile setup is already complete.',

  FORBIDDEN: "You don't have permission to do that.",
  CAPABILITY_DENIED: "You can't perform this action right now.",
  RESOURCE_FORBIDDEN: "You don't have access to this.",
  RESOURCE_PRIVATE: "This profile or content isn't publicly available.",
  BLOCKED: "You can't interact with this user.",

  VALIDATION: 'Please check the information you entered.',
  REQUIRED_FIELD: 'This field is required.',
  INVALID_INPUT: "The information provided isn't valid.",
  INVALID_FORMAT: 'Please enter a valid value.',
  INVALID_ID: "The requested item couldn't be identified.",
  INVALID_ACTION: "That action isn't available.",
  INVALID_STATE: 'This action is no longer available.',

  NOT_FOUND: "The requested item couldn't be found.",
  PROFILE_NOT_FOUND: 'Profile not found.',
  IDEA_NOT_FOUND: 'Idea not found.',
  EVENT_NOT_FOUND: 'Event not found.',
  MATCH_NOT_FOUND: 'Match not found.',
  CONVERSATION_NOT_FOUND: 'Conversation not found.',
  MESSAGE_NOT_FOUND: 'Message not found.',

  CONFLICT: 'This action conflicts with the current state.',
  ALREADY_EXISTS: 'This already exists.',
  ALREADY_MATCHED: "You're already matched.",
  ALREADY_VALIDATED: "You've already validated this idea.",
  ALREADY_SPARKED: "You've already sparked this idea.",
  ALREADY_JOINED: "You've already requested to join this idea.",
  ALREADY_REGISTERED: "You're already registered for this event.",
  ALREADY_BLOCKED: 'This user is already blocked.',

  RATE_LIMITED:
    "You're doing that a little too quickly. Please try again shortly.",
  TOO_MANY_REQUESTS: 'Too many requests. Please try again shortly.',
  ACTION_COOLDOWN: 'Please wait a moment before trying that again.',

  NETWORK: "We couldn't connect. Check your connection and try again.",
  TIMEOUT: 'The request took too long. Please try again.',
  SERVICE_UNAVAILABLE:
    'This service is temporarily unavailable. Please try again.',
  EXTERNAL_SERVICE:
    'A connected service is temporarily unavailable. Please try again.',
  STORAGE_ERROR: "We couldn't save the file. Please try again.",
  REALTIME_ERROR: 'Live updates are temporarily unavailable.',
  DATABASE_ERROR: "We couldn't complete that request. Please try again.",
  INTERNAL: 'Something went wrong. Please try again.',
}

/**
 * Authentication / onboarding messages.
 */
export const AUTH_MESSAGES = {
  LOGIN_TITLE: 'Welcome to Connect',
  LOGIN_SUBTITLE:
    'Meet people, discover ideas and build meaningful connections.',
  LINKEDIN_CTA: 'Continue with LinkedIn',
  LINKEDIN_LOADING: 'Connecting to LinkedIn…',
  LINKEDIN_FAILED: "LinkedIn sign-in couldn't be completed.",
  LOGIN_SUCCESS: 'Welcome back.',
  LOGOUT_SUCCESS: 'You have been signed out.',
  SIGN_IN_REQUIRED_TITLE: 'Sign in to continue',
  SIGN_IN_REQUIRED_DESCRIPTION:
    'Continue with LinkedIn to take part in Connect.',
  ONBOARDING_TITLE: 'Complete your Connect profile',
  ONBOARDING_SUBTITLE:
    "Your LinkedIn profile gives you a starting point. Add two things so people know what you're about.",
  ONBOARDING_BIO_LABEL: 'Tell people about yourself',
  ONBOARDING_BIO_PLACEHOLDER:
    'A short introduction about who you are and what you do.',
  ONBOARDING_IDEA_LABEL: 'What are you building?',
  ONBOARDING_IDEA_PLACEHOLDER:
    'Share the idea, project or direction you want people to know about.',
  ONBOARDING_CONTINUE: 'Continue',
  ONBOARDING_SAVING: 'Saving…',
  ONBOARDING_COMPLETE: "You're all set.",
  ONBOARDING_COMPLETE_DESCRIPTION: 'Your Connect profile is ready.',
} as const

/**
 * Gate / capability messages.
 */
export const GATE_MESSAGES = {
  GUEST_DISCOVER: 'Sign in with LinkedIn to discover more people.',
  GUEST_SCROLL: 'Sign in with LinkedIn to keep exploring.',
  GUEST_SWIPE: 'Sign in with LinkedIn to start discovering people.',
  GUEST_SEARCH: 'Sign in with LinkedIn to search Connect.',
  GUEST_VALIDATE: 'Sign in with LinkedIn to validate ideas.',
  GUEST_SPARK: 'Sign in with LinkedIn to spark an idea.',
  GUEST_JOIN: 'Sign in with LinkedIn to join an idea.',
  GUEST_CONNECT: 'Sign in with LinkedIn to connect.',
  GUEST_MESSAGE: 'Sign in with LinkedIn to message people.',
  GUEST_SAVE: 'Sign in with LinkedIn to save this.',
  GUEST_REGISTER: 'Sign in with LinkedIn to register.',
  GUEST_EDIT_PROFILE: 'Sign in with LinkedIn to edit your profile.',
  ONBOARDING_DISCOVER: 'Finish your profile setup to discover people.',
  ONBOARDING_IDEAS: 'Finish your profile setup to interact with ideas.',
  ONBOARDING_EVENTS: 'Finish your profile setup to take part in events.',
  ONBOARDING_MATCHES: 'Finish your profile setup to continue.',
  ONBOARDING_CHAT: 'Finish your profile setup to start messaging.',
} as const

/**
 * Validation messages.
 *
 * Keep validation copy specific enough for users but independent
 * from backend implementation.
 */
export const VALIDATION_MESSAGES = {
  COMMON: {
    REQUIRED: 'This field is required.',
    TOO_SHORT: 'This value is too short.',
    TOO_LONG: 'This value is too long.',
    INVALID: 'Please enter a valid value.',
    INVALID_FORMAT: "The format isn't valid.",
  },

  AUTH: {
    INVALID_CALLBACK: "We couldn't complete sign-in.",
    INVALID_PROVIDER_RESPONSE:
      "LinkedIn didn't return the information we need.",
  },

  PROFILE: {
    NAME_REQUIRED: 'Your name is required.',
    BIO_REQUIRED: 'Add a short bio to continue.',
    BIO_TOO_SHORT: 'Your bio is too short.',
    BIO_TOO_LONG: 'Your bio is too long.',
    ROLE_TOO_LONG: 'Your role is too long.',
    COMPANY_TOO_LONG: 'Your company name is too long.',
    LOCATION_TOO_LONG: 'Your location is too long.',
    IDEA_REQUIRED: 'Add your profile idea to continue.',
    IDEA_TOO_SHORT: 'Your profile idea is too short.',
    IDEA_TOO_LONG: 'Your profile idea is too long.',
    INVALID_VISIBILITY: 'Choose a valid visibility option.',
    INVALID_AVATAR: 'Choose a valid profile image.',
    AVATAR_TOO_LARGE: 'Your profile image is too large.',
  },

  DISCOVER: {
    INVALID_DIRECTION: "That discovery action isn't valid.",
    INVALID_TARGET: 'That profile is no longer available.',
  },

  CHAT: {
    MESSAGE_REQUIRED: 'Write a message before sending.',
    MESSAGE_TOO_LONG: 'Your message is too long.',
    MESSAGE_EMPTY: "Your message can't be empty.",
    ATTACHMENT_TOO_LARGE: 'That file is too large.',
    UNSUPPORTED_ATTACHMENT: "That file type isn't supported.",
  },

  IDEA: {
    TITLE_REQUIRED: 'Add an idea title.',
    TITLE_TOO_LONG: 'Your idea title is too long.',
    SUMMARY_REQUIRED: 'Add a short summary.',
    SUMMARY_TOO_LONG: 'Your summary is too long.',
    PROBLEM_REQUIRED: "Describe the problem you're solving.",
    SOLUTION_REQUIRED: 'Describe your solution.',
    INVALID_STAGE: 'Choose a valid idea stage.',
    INVALID_CATEGORY: 'Choose a valid category.',
  },

  EVENT: {
    TITLE_REQUIRED: 'Add an event title.',
    DESCRIPTION_REQUIRED: 'Add an event description.',
    START_DATE_REQUIRED: 'Choose a start date.',
    INVALID_DATE_RANGE: 'The event dates are not valid.',
    LOCATION_REQUIRED: 'Add an event location.',
    CAPACITY_INVALID: 'Enter a valid capacity.',
    MEDIA_REQUIRED: 'Add the required event media.',
    INVALID_MEDIA_TYPE: "This media type isn't supported.",
    MEDIA_TOO_LARGE: 'This media file is too large.',
  },

  SEARCH: {
    QUERY_REQUIRED: 'Enter something to search for.',
    QUERY_TOO_LONG: 'Your search is too long.',
    INVALID_FILTER: "That filter isn't available.",
  },
} as const

/**
 * Success messages.
 */
export const SUCCESS_MESSAGES = {
  PROFILE: {
    UPDATED: 'Profile updated.',
    AVATAR_UPDATED: 'Profile photo updated.',
    IDEA_UPDATED: 'Profile idea updated.',
    VISIBILITY_UPDATED: 'Profile visibility updated.',
  },

  ONBOARDING: {
    COMPLETED: 'Your profile is ready.',
  },

  DISCOVER: {
    PASSED: 'Passed.',
    INTERESTED: 'Interest saved.',
    SPARKED: 'Spark sent.',
  },

  MATCHES: {
    CREATED: "It's a match.",
    UNMATCHED: 'Match removed.',
  },

  CHAT: {
    SENT: 'Message sent.',
    COPIED: 'Message copied.',
    DELETED: 'Message deleted.',
  },

  IDEAS: {
    CREATED: 'Idea published.',
    UPDATED: 'Idea updated.',
    VALIDATED: 'Idea validated.',
    SPARKED: 'Idea sparked.',
    JOIN_REQUESTED: 'Join request sent.',
    SAVED: 'Idea saved.',
    UNSAVED: 'Idea removed from saved ideas.',
  },

  EVENTS: {
    CREATED: 'Event created.',
    UPDATED: 'Event updated.',
    REGISTERED: "You're registered.",
    UNREGISTERED: 'Registration cancelled.',
    SAVED: 'Event saved.',
    UNSAVED: 'Event removed from saved events.',
    MEDIA_UPLOADED: 'Media uploaded.',
    MEDIA_UPDATED: 'Media updated.',
    MEDIA_DELETED: 'Media removed.',
    CHECKED_IN: 'Attendee checked in.',
    CHECK_IN_REVERSED: 'Check-in reversed.',
  },

  SETTINGS: {
    SAVED: 'Settings saved.',
    PRIVACY_UPDATED: 'Privacy settings updated.',
    NOTIFICATIONS_UPDATED: 'Notification preferences saved.',
  },

  ADMIN: {
    REPORT_REVIEWED: 'Report marked as reviewed.',
    REPORT_RESOLVED: 'Report resolved.',
    USER_SUSPENDED: 'User suspended.',
    USER_UNSUSPENDED: 'User suspension removed.',
  },
} as const

/**
 * Informational messages.
 */
export const INFO_MESSAGES = {
  PROFILE: {
    NO_BIO: "This person hasn't added a bio yet.",
    NO_IDEA: "This person hasn't added a profile idea yet.",
    NO_SKILLS: 'No skills added yet.',
    PROFILE_COMPLETION: 'Complete your profile to help people understand you.',
  },

  DISCOVER: {
    LOADING: 'Finding people for you…',
    EMPTY: "You've reached the end for now.",
    REFRESHING: 'Refreshing recommendations…',
    NO_RESULTS: "We couldn't find more people right now.",
  },

  MATCHES: {
    EMPTY: 'Your matches will appear here.',
    EMPTY_DESCRIPTION:
      'Keep discovering people and your mutual connections will show up here.',
    NO_NEW: 'No new matches.',
    NO_ACTIVE: 'No active conversations yet.',
  },

  CHAT: {
    LOADING: 'Loading conversation…',
    EMPTY: 'Start the conversation.',
    RECONNECTING: 'Reconnecting…',
    OFFLINE: "You're offline. Messages will retry when you're back online.",
  },

  IDEAS: {
    LOADING: 'Finding ideas for you…',
    EMPTY: 'No ideas to show right now.',
    END: "You've reached the end for now.",
    SAVED_EMPTY: 'Your saved ideas will appear here.',
  },

  EVENTS: {
    LOADING: 'Finding events…',
    EMPTY: 'No events found.',
    SEARCH_EMPTY: 'No events match your search.',
    CATEGORY_EMPTY: 'No events in this category yet.',
    REGISTRATION_CLOSED: 'Registration is currently closed.',
    SOLD_OUT: 'This event is full.',
  },

  SEARCH: {
    LOADING: 'Searching…',
    EMPTY: 'No results found.',
  },

  PROFILE_EDIT: {
    SAVING: 'Saving changes…',
    UNSAVED_CHANGES: 'You have unsaved changes.',
  },
} as const

/**
 * Error/empty/loading page messages.
 */
export const SYSTEM_MESSAGES = {
  GENERIC_ERROR_TITLE: 'Something went wrong',
  GENERIC_ERROR_DESCRIPTION: "We couldn't complete that request.",
  RETRY: 'Try again',
  RETRYING: 'Trying again…',
  BACK: 'Go back',
  GO_HOME: 'Go home',

  NOT_FOUND_TITLE: "We couldn't find that",
  NOT_FOUND_DESCRIPTION:
    "The page or content you're looking for isn't available.",

  OFFLINE_TITLE: "You're offline",
  OFFLINE_DESCRIPTION: 'Check your internet connection and try again.',

  MAINTENANCE_TITLE: 'Connect is temporarily unavailable',
  MAINTENANCE_DESCRIPTION: 'Please try again in a little while.',
} as const

/**
 * Action labels.
 */
export const ACTION_MESSAGES = {
  SAVE: 'Save',
  SAVED: 'Saved',
  SHARE: 'Share',
  CLOSE: 'Close',
  CANCEL: 'Cancel',
  CONFIRM: 'Confirm',
  CONTINUE: 'Continue',
  RETRY: 'Try again',
  EDIT: 'Edit',
  DELETE: 'Delete',
  REMOVE: 'Remove',
  BACK: 'Back',

  DISCOVER: {
    PASS: 'Pass',
    INTEREST: 'Interested',
    SPARK: 'Spark',
    VIEW_PROFILE: 'View profile',
    UNDO: 'Undo',
  },

  MATCHES: {
    OPEN: 'Open match',
    MESSAGE: 'Message',
    UNMATCH: 'Unmatch',
    REPORT: 'Report',
  },

  CHAT: {
    SEND: 'Send',
    ATTACH: 'Attach',
    COPY: 'Copy',
    DELETE: 'Delete',
    MARK_READ: 'Mark as read',
  },

  IDEAS: {
    VALIDATE: 'Validate',
    VALIDATED: 'Validated',
    SPARK: 'Spark',
    JOIN: 'Join',
    SAVE: 'Save',
    SAVED: 'Saved',
    PUBLISH: 'Publish idea',
  },

  EVENTS: {
    REGISTER: 'Register',
    REGISTERED: 'Registered',
    SAVE: 'Save',
    SAVED: 'Saved',
    SHARE: 'Share',
    ADD_TO_CALENDAR: 'Add to calendar',
  },

  PROFILE: {
    EDIT: 'Edit profile',
    CHANGE_PHOTO: 'Change photo',
    VIEW_LINKEDIN: 'View LinkedIn',
    COMPLETE: 'Complete profile',
  },
} as const

/**
 * Accessibility announcements.
 *
 * These are deliberately separate from visible labels.
 */
export const ARIA_MESSAGES = {
  DISCOVER: {
    CARD_AVAILABLE: 'Profile available.',
    PASSING: 'Passing on this profile.',
    INTERESTING: 'Showing interest in this profile.',
    SPARKING: 'Sparking this profile.',
    RETURNED: 'Swipe cancelled. Profile returned.',
    LOADED_NEXT: 'Next profile loaded.',
    END_REACHED: 'No more profiles are available right now.',
  },

  MATCHES: {
    NEW_MATCH: 'New match created.',
  },

  CHAT: {
    NEW_MESSAGE: 'New message received.',
    MESSAGE_SENT: 'Message sent.',
    TYPING: 'The other person is typing.',
  },

  IDEAS: {
    VALIDATED: 'Idea validated.',
    SPARKED: 'Idea sparked.',
    JOIN_REQUESTED: 'Join request sent.',
  },
} as const

/**
 * Moderation / safety messages.
 */
export const SAFETY_MESSAGES = {
  REPORT: {
    TITLE: 'Report content',
    SUCCESS: 'Thanks. Your report has been submitted.',
    FAILED: "We couldn't submit your report. Please try again.",
  },

  BLOCK: {
    CONFIRM_TITLE: 'Block this person?',
    CONFIRM_DESCRIPTION: "They won't be able to interact with you on Connect.",
    SUCCESS: 'User blocked.',
  },

  UNBLOCK: {
    CONFIRM_TITLE: 'Unblock this person?',
    CONFIRM_DESCRIPTION: 'They may be able to interact with you again.',
    SUCCESS: 'User unblocked.',
  },

  DELETE_ACCOUNT: {
    CONFIRM_TITLE: 'Delete your account?',
    CONFIRM_DESCRIPTION: "This action can't be undone.",
    CONFIRM_PHRASE: 'DELETE',
    SUCCESS: 'Your account has been deleted.',
  },
} as const

/**
 * Event-specific operational messages.
 */
export const EVENT_MESSAGES = {
  REGISTRATION: {
    SUCCESS: "You're registered for this event.",
    WAITLISTED: "You're on the waitlist.",
    CANCELLED: 'Your registration has been cancelled.',
    CLOSED: 'Registration is closed.',
    FULL: 'This event is currently full.',
    NOT_OPEN: "Registration hasn't opened yet.",
  },

  ATTENDANCE: {
    CHECKED_IN: "You're checked in.",
    NOT_FOUND: 'Registration not found.',
    WAITLISTED_CANNOT_CHECK_IN:
      'Waitlisted registrations cannot be checked in.',
  },

  ORGANIZER: {
    AUTH_REQUIRED: 'Organizer sign-in is required.',
    NOT_AUTHORIZED: "You aren't authorized to manage this event.",
  },

  MEDIA: {
    EVENT_ID_REQUIRED: 'Event ID is required.',
    MEDIA_ID_REQUIRED: 'Media ID is required.',
    ORGANIZER_ID_REQUIRED: 'Organizer ID is required.',
    FILE_NAME_REQUIRED: 'File name is required.',
    CONTENT_TYPE_REQUIRED: 'Content type is required.',
    MEDIA_NOT_FOUND: 'Media not found.',
    INVALID_ORDER: "Media ordering isn't valid.",
    INVALID_SIZE: "Media file size isn't valid.",
    INVALID_DURATION: "Media duration isn't valid.",
  },
} as const

/**
 * Data export / privacy / account messages.
 */
export const PRIVACY_MESSAGES = {
  EXPORT: {
    REQUESTED: 'Your data export request has been received.',
    FAILED: "We couldn't request your data export.",
  },

  ERASURE: {
    REQUESTED: 'Your account deletion request has been received.',
    FAILED: "We couldn't process your deletion request.",
  },

  VISIBILITY: {
    UPDATED: 'Visibility updated.',
  },
} as const

/**
 * Development / internal messages.
 *
 * These should be used for logs/errors where technical context is needed.
 * They must never be rendered directly in a normal user-facing component.
 */
export const INTERNAL_MESSAGES = {
  AUTH: {
    MISSING_USER: 'Authentication user missing.',
    OAUTH_EXCHANGE_FAILED: 'OAuth session exchange failed.',
    PROFILE_PROVISION_FAILED: 'Profile provisioning failed.',
    IDENTITY_SYNC_FAILED: 'Identity synchronization failed.',
  },

  PROFILE: {
    FETCH_FAILED: 'Profile fetch failed.',
    UPDATE_FAILED: 'Profile update failed.',
    AVATAR_UPLOAD_FAILED: 'Avatar upload failed.',
  },

  DISCOVER: {
    FETCH_FAILED: 'Discover candidate fetch failed.',
    RANKING_FAILED: 'Discover ranking failed.',
    SWIPE_FAILED: 'Swipe action failed.',
    MATCH_CREATION_FAILED: 'Match creation failed.',
  },

  MATCHES: {
    FETCH_FAILED: 'Matches fetch failed.',
    CREATE_FAILED: 'Match creation failed.',
  },

  CHAT: {
    FETCH_FAILED: 'Conversation/message fetch failed.',
    SEND_FAILED: 'Message send failed.',
    READ_FAILED: 'Message read-state update failed.',
    REALTIME_FAILED: 'Realtime subscription failed.',
  },

  IDEAS: {
    FETCH_FAILED: 'Ideas feed fetch failed.',
    CREATE_FAILED: 'Idea creation failed.',
    VALIDATION_FAILED: 'Idea validation failed.',
    SPARK_FAILED: 'Idea spark failed.',
    JOIN_FAILED: 'Idea join request failed.',
  },

  EVENTS: {
    FETCH_FAILED: 'Event fetch failed.',
    REGISTRATION_FAILED: 'Event registration failed.',
    ATTENDANCE_FAILED: 'Attendance operation failed.',
    MEDIA_FAILED: 'Event media operation failed.',
    ANALYTICS_FAILED: 'Event analytics operation failed.',
  },

  DATABASE: {
    QUERY_FAILED: 'Database query failed.',
    TRANSACTION_FAILED: 'Database transaction failed.',
    CONSTRAINT_FAILED: 'Database constraint failed.',
  },

  EXTERNAL: {
    PROVIDER_FAILED: 'External provider request failed.',
    STORAGE_FAILED: 'Storage operation failed.',
    REALTIME_FAILED: 'Realtime operation failed.',
  },
} as const

/**
 * Dynamic message helpers.
 *
 * Keep IDs and technical details OUT of user-facing copy.
 */
export const MESSAGE = {
  validation(field: string): string {
    return `${field} is required.`
  },

  minLength(field: string, min: number): string {
    return `${field} must be at least ${min} characters.`
  },

  maxLength(field: string, max: number): string {
    return `${field} must be ${max} characters or fewer.`
  },

  remaining(count: number, singular: string, plural?: string): string {
    if (count === 1) {
      return `1 ${singular}`
    }

    return `${count} ${plural ?? `${singular}s`}`
  },

  unread(count: number): string {
    return count === 1 ? '1 unread message' : `${count} unread messages`
  },

  validationCount(count: number): string {
    return count === 1 ? '1 validation' : `${count} validations`
  },

  memberCount(count: number): string {
    return count === 1 ? '1 member' : `${count} members`
  },
}

/**
 * Default safe error fallback.
 */
export const DEFAULT_ERROR_CODE = ERROR_CODES.INTERNAL
export const DEFAULT_ERROR_MESSAGE = ERROR_MESSAGES.INTERNAL

/**
 * Helpers used by AppError / API normalization.
 */
export function getErrorStatus(code: ErrorCode): number {
  return ERROR_STATUS[code] ?? ERROR_STATUS[DEFAULT_ERROR_CODE]
}

export function getErrorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] ?? DEFAULT_ERROR_MESSAGE
}

export function isErrorCode(value: string): value is ErrorCode {
  return Object.values(ERROR_CODES).includes(value as ErrorCode)
}
