// src/services/connections/connection.schema.ts
// W3.5 — People Connections: Zod schemas + pure DTO projections.
//
// Connection requests are people-first (separate from idea join requests).
// DTOs are narrow and privacy-aware: they only expose public profile fields of
// the counterparty (ProfileSummaryDTO-style), never contact info or hidden
// identity.
//
// All projection functions are PURE (no I/O) for testability.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod'
import { uuidSchema } from '@/lib/validation'

// ─── Input schemas ───────────────────────────────────────────────────────────

export const sendConnectionRequestSchema = z
  .object({
    addresseeId: uuidSchema.describe('The user you want to connect with'),
    message: z
      .string()
      .max(500, 'Message must be at most 500 characters')
      .trim()
      .optional()
      .or(z.literal('')),
  })
  .strict()

export type SendConnectionRequestInput = z.infer<
  typeof sendConnectionRequestSchema
>

export const respondConnectionRequestSchema = z
  .object({
    requestId: uuidSchema,
    decision: z.enum(['accept', 'decline']),
  })
  .strict()

export type RespondConnectionRequestInput = z.infer<
  typeof respondConnectionRequestSchema
>

// ─── respond_connection_request RPC result schema ───────────────────────────
// Postgres returns jsonb_build_object(...) — validate before trusting it.
export const connectionResultSchema = z
  .object({
    ok: z.boolean(),
    status: z.enum(['accepted', 'declined']).nullable(),
    match_id: z.string().uuid().nullable(),
    reason: z.string().nullable(),
  })
  .strict()

export type ConnectionResult = z.infer<typeof connectionResultSchema>

// ─── DTO projections ─────────────────────────────────────────────────────────

export const ConnectionRequestDTOSchema = z
  .object({
    id: z.string().uuid(),
    requesterId: z.string().uuid(),
    addresseeId: z.string().uuid(),
    status: z.enum(['pending', 'accepted', 'declined']),
    message: z.string().nullable(),
    createdAt: z.string(),
    // The other party's public summary (browse-safe, no PII).
    counterpart: z
      .object({
        id: z.string().uuid(),
        fullName: z.string(),
        role: z.string().nullable(),
        avatarUrl: z.string().url().nullable(),
        headline: z.string().nullable(),
        topSkills: z.array(z.string()).max(3),
      })
      .nullable(),
  })
  .strict()

export type ConnectionRequestDTO = z.infer<typeof ConnectionRequestDTOSchema>

/** Input row for a connection request (snake_case from the DB). */
export interface ConnectionRequestRow {
  id: string
  requester_id?: string
  addressee_id?: string
  status?: string
  message?: string | null
  created_at?: string | null
  [key: string]: unknown
}

/** Public counterpart summary input (camelCase profile projection). */
export interface ConnectionCounterpart {
  id: string
  /** The active match id pairing user + counterpart (null when none active). */
  matchId: string | null
  fullName: string
  role: string | null
  avatarUrl: string | null
  headline: string | null
  topSkills: string[]
}

/**
 * Project a raw connection request row + a counterpart summary into a
 * ConnectionRequestDTO. Pure.
 */
export function toConnectionRequestDTO(
  row: ConnectionRequestRow,
  counterpart: ConnectionCounterpart | null,
): ConnectionRequestDTO {
  return {
    id: row.id,
    requesterId: row.requester_id ?? '',
    addresseeId: row.addressee_id ?? '',
    status: (row.status as ConnectionRequestDTO['status']) ?? 'pending',
    message: row.message ?? null,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    counterpart,
  }
}
