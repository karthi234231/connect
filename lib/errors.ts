// src/lib/errors.ts

export const ErrorCodes = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  PROFILE_PROVISIONING_REQUIRED: 'PROFILE_PROVISIONING_REQUIRED',
  FORBIDDEN_SUSPENDED: 'FORBIDDEN_SUSPENDED',
  FORBIDDEN_DELETED: 'FORBIDDEN_DELETED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  BLOCKED: 'BLOCKED',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE',
  // ── S55 — spec UI mapping (RETURN SHAPE code set) ──
  // Stable wire aliases exposed through toErrorPayload(); kept as AppError
  // codes so `fromUnknown` can mint them and the serializer stays total.
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  RETRYABLE_PROVIDER: 'RETRYABLE_PROVIDER',
  UNAVAILABLE: 'UNAVAILABLE',
  INTERNAL: 'INTERNAL',
  // ── S17/17A — recommendation snapshot error contract ──
  // Forged/foreign/mismatched snapshot (never replayable, never cross-user).
  RECOMMENDATION_INVALID: 'RECOMMENDATION_INVALID',
  // Snapshot HMAC/format fails (same user-safe surface as INVALID).
  RECOMMENDATION_FORGED: 'RECOMMENDATION_FORGED',
  // Absolute expiry passed.
  RECOMMENDATION_EXPIRED: 'RECOMMENDATION_EXPIRED',
  // Discover epoch bumped since the snapshot was minted.
  RECOMMENDATION_STALE: 'RECOMMENDATION_STALE',
  // Snapshot already consumed by a prior swipe this epoch.
  RECOMMENDATION_CONSUMED: 'RECOMMENDATION_CONSUMED',
  // Score version drifted since the snapshot was minted.
  RECOMMENDATION_VERSION_MISMATCH: 'RECOMMENDATION_VERSION_MISMATCH',
  // ── P0-10 — daily right-swipe quota exhausted (spec error catalog code
  // MATCH_RIGHT_SWIPES_EXHAUSTED §12922 + §1213 copy). Retryable tomorrow;
  // never retry today (it cannot succeed).
  QUOTA_EXHAUSTED: 'QUOTA_EXHAUSTED',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

const StatusMap: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  PROFILE_PROVISIONING_REQUIRED: 409,
  FORBIDDEN_SUSPENDED: 403,
  FORBIDDEN_DELETED: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  BLOCKED: 403,
  EXTERNAL_SERVICE: 503,
  // S55 wire aliases (spec mapping) — transport status only, no copy change.
  AUTH_REQUIRED: 401,
  RETRYABLE_PROVIDER: 503,
  UNAVAILABLE: 503,
  INTERNAL: 500,
  // S17/17A — snapshot verification failures are client-actionable refresh
  // signals; the browser refetches a fresh batch. STALE/CONSUMED (409) and
  // EXPIRED/VERSION_MISMATCH (410 Gone) stay distinct so retry logic can
  // branch; INVALID/FORGED are 400s (never retry the same payload).
  RECOMMENDATION_INVALID: 400,
  RECOMMENDATION_FORGED: 400,
  RECOMMENDATION_EXPIRED: 410,
  RECOMMENDATION_STALE: 409,
  RECOMMENDATION_CONSUMED: 409,
  RECOMMENDATION_VERSION_MISMATCH: 410,
  // Quota exhaustion is a 429 (rate-limit semantics): retryable tomorrow.
  QUOTA_EXHAUSTED: 429,
}

/**
 * S55 — canonical wire payload. Exactly `{code,message,retryable,correlationId?}`.
 * `code` is the stable spec code (UI mapping set); `message` is ALWAYS a safe
 * canned string (AppError internals / raw SQL / provider detail never leave the
 * server — they stay in `cause`/server logs). `retryable` derives from the code
 * so clients can branch without parsing copy. `correlationId` is stamped when
 * the caller (API route / logger) has one; AppError itself stays correlation-
 * free so server actions don't mint request ids.
 */
export interface ErrorPayload {
  code: string
  message: string
  retryable: boolean
  correlationId?: string
}

/** Spec §55 UI mapping → stable wire code. Exhaustive over ErrorCode. */
const WIRE_CODE_MAP: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'AUTH_REQUIRED',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  PROFILE_PROVISIONING_REQUIRED: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  FORBIDDEN_SUSPENDED: 'FORBIDDEN',
  FORBIDDEN_DELETED: 'FORBIDDEN',
  BLOCKED: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  EXTERNAL_SERVICE: 'RETRYABLE_PROVIDER',
  RETRYABLE_PROVIDER: 'RETRYABLE_PROVIDER',
  UNAVAILABLE: 'UNAVAILABLE',
  INTERNAL: 'UNAVAILABLE',
  // Snapshot codes are already stable wire codes (client branches on them).
  RECOMMENDATION_INVALID: 'VALIDATION',
  RECOMMENDATION_FORGED: 'VALIDATION',
  RECOMMENDATION_EXPIRED: 'VALIDATION',
  RECOMMENDATION_STALE: 'CONFLICT',
  RECOMMENDATION_CONSUMED: 'CONFLICT',
  RECOMMENDATION_VERSION_MISMATCH: 'VALIDATION',
  // Spec wire code — client branches to the quota-exhausted state.
  QUOTA_EXHAUSTED: 'MATCH_RIGHT_SWIPES_EXHAUSTED',
}

/** Spec §55 retryable set: rate-limit / transient provider / unavailable. */
const RETRYABLE_CODES = new Set<string>([
  'RATE_LIMITED',
  'RETRYABLE_PROVIDER',
  'UNAVAILABLE',
])

/** Safe canned copy per wire code — the only strings that reach the browser. */
const WIRE_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Please sign in to continue.',
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "The requested item couldn't be found.",
  RATE_LIMITED:
    "You're doing that a little too quickly. Please try again shortly.",
  RETRYABLE_PROVIDER:
    'A connected service is temporarily unavailable. Please try again.',
  VALIDATION: 'Please check the information you entered.',
  CONFLICT:
    'This action conflicts with the current state. Please refresh and try again.',
  UNAVAILABLE: 'Something went wrong. Please try again.',
  // Spec §1213 quota copy — exact catalogue message.
  MATCH_RIGHT_SWIPES_EXHAUSTED:
    "You've used all 10 of today's introductions — new ones arrive tomorrow. Make each one count.",
}

/**
 * Serialize ANY thrown value to the S55 wire shape. Never throws. Non-AppError
 * inputs (raw Error, PostgREST `{message,code,details,hint}`, strings) collapse
 * to UNAVAILABLE with the canned message — provider/SQL text never passes
 * through (`String(err)` is intentionally NOT used as the message).
 */
export function toErrorPayload(
  err: unknown,
  options?: { correlationId?: string },
): ErrorPayload {
  if (err instanceof AppError) {
    const wireCode = WIRE_CODE_MAP[err.code] ?? 'UNAVAILABLE'
    const payload: ErrorPayload = {
      code: wireCode,
      message:
        err.userMessage ?? WIRE_MESSAGES[wireCode] ?? WIRE_MESSAGES.UNAVAILABLE,
      retryable: RETRYABLE_CODES.has(wireCode),
    }
    if (options?.correlationId) payload.correlationId = options.correlationId
    return payload
  }
  const payload: ErrorPayload = {
    code: 'UNAVAILABLE',
    message: WIRE_MESSAGES.UNAVAILABLE,
    retryable: true,
  }
  if (options?.correlationId) payload.correlationId = options.correlationId
  return payload
}

export interface ApiErrorPayload {
  error: {
    code: string
    message: string
    requestId?: string
  }
}

export interface ApiOkPayload<T> {
  data: T
}

export function apiError(
  code: ErrorCode,
  message: string,
  requestId?: string,
): ApiErrorPayload {
  return {
    error: {
      code,
      message,
      requestId,
    },
  }
}

export function apiOk<T>(data: T, _requestId?: string): ApiOkPayload<T> {
  return { data }
}

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly context?: Record<string, unknown>
  public readonly userMessage?: string

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      cause?: unknown
      context?: Record<string, unknown>
      userMessage?: string
    },
  ) {
    super(message, { cause: options?.cause })
    this.code = code
    this.statusCode = StatusMap[code] || 500
    this.context = options?.context
    this.userMessage = options?.userMessage
    this.name = 'AppError'

    Error.captureStackTrace(this, AppError)
  }

  static isAppError(err: unknown): err is AppError {
    return err instanceof AppError
  }

  static fromUnknown(
    err: unknown,
    fallbackCode: ErrorCode = ErrorCodes.INTERNAL,
    options?: {
      context?: Record<string, unknown>
    },
  ): AppError {
    if (err instanceof AppError) {
      return err
    }
    if (err instanceof Error) {
      // S55 — err.message stays internal (server logs via `cause`); the wire
      // message is ALWAYS the canned copy from toErrorPayload().
      return new AppError(
        fallbackCode,
        err.message || 'An unexpected error occurred.',
        {
          cause: err,
          context: options?.context,
        },
      )
    }
    return new AppError(fallbackCode, 'An unexpected error occurred.', {
      context: options?.context,
    })
  }

  static validation(message: string, fieldErrors?: Record<string, string[]>) {
    return new AppError(ErrorCodes.VALIDATION, message, {
      context: { fieldErrors },
    })
  }

  static notFound(resource: string, id?: string) {
    const message = id
      ? `${resource} not found (id: ${id})`
      : `${resource} not found`
    return new AppError(ErrorCodes.NOT_FOUND, message)
  }

  static forbidden(
    reason: string = "You don't have permission to perform this action.",
  ) {
    return new AppError(ErrorCodes.FORBIDDEN, reason)
  }

  static unauthenticated(message: string = 'Authentication required.') {
    return new AppError(ErrorCodes.UNAUTHENTICATED, message)
  }

  static conflict(message: string) {
    return new AppError(ErrorCodes.CONFLICT, message)
  }

  static rateLimited(
    message: string = 'Too many requests. Please try again later.',
  ) {
    return new AppError(ErrorCodes.RATE_LIMITED, message)
  }
}
