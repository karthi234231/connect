// src/services/linkedin/errors.ts
// Typed failures for the LinkedIn provider adapter. Base is the repo AppError
// so every failure carries a canonical code + HTTP status. Zod internals are
// never leaked on the public surface: parse failures are normalized to a plain
// `{ path, message }[]` shape.
import type { z } from 'zod'
import { AppError, ErrorCodes } from '@/lib/errors'

export class ProviderUnavailableError extends AppError {
  constructor(
    message: string,
    options?: { cause?: unknown; context?: Record<string, unknown> },
  ) {
    super(ErrorCodes.EXTERNAL_SERVICE, message, options)
    this.name = 'ProviderUnavailableError'
  }
}

export class ProviderRevokedError extends AppError {
  constructor(
    message: string,
    options?: { cause?: unknown; context?: Record<string, unknown> },
  ) {
    super(ErrorCodes.FORBIDDEN, message, options)
    this.name = 'ProviderRevokedError'
  }
}

export interface ProviderValidationIssue {
  path: string
  message: string
}

export class InvalidProviderResponseError extends AppError {
  /**
   * Normalized validation issues — plain, serializable `{ path, message }`,
   * never a `z.ZodError`/`z.ZodIssue[]` on the public surface.
   */
  public readonly issues: readonly ProviderValidationIssue[]

  constructor(
    message: string,
    options?: {
      cause?: unknown
      context?: Record<string, unknown>
      zodError?: z.ZodError
    },
  ) {
    super(ErrorCodes.VALIDATION, message, {
      cause: options?.cause,
      context: options?.context,
    })
    this.name = 'InvalidProviderResponseError'
    this.issues = (options?.zodError?.issues ?? []).map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    }))
  }
}
