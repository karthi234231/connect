// src/app/actions/relationship-momentum.ts
// V10-BE-01 — trust boundary for relationship momentum: zod-validated input,
// actor taken from the verified session only, and safe user-facing errors.
'use server'

import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { AppError, ErrorCodes } from '@/lib/errors'
import { uuidSchema } from '@/lib/validation'
import {
  getRelationshipState,
  type RelationshipState,
} from '@/services/relationships'

const inputSchema = z.object({ matchId: uuidSchema }).strict()

export async function getRelationshipStateAction(input: {
  matchId: string
}): Promise<RelationshipState> {
  const actorId = await requireUser()

  const parsed = inputSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'That conversation reference is not valid.',
    )
  }

  try {
    return await getRelationshipState(actorId, parsed.data.matchId)
  } catch (error) {
    // AppError (403/404/409) already carries safe copy — pass it through.
    if (AppError.isAppError(error)) {
      throw error
    }

    // Unknown failure: never leak internals (SQL, table names) to the client.
    throw new AppError(
      ErrorCodes.INTERNAL,
      'Something went wrong. Please try again.',
      { cause: error },
    )
  }
}
