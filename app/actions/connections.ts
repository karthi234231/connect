// src/app/actions/connections.ts
// Connection request mutations. Zod .strict() at the boundary; identity from
// the verified session; errors surface as AppError for the caller to render.
'use server'

import { requireUser } from '@/lib/auth'
import { AppError, ErrorCodes } from '@/lib/errors'
import {
  respondConnectionRequest,
  sendConnectionRequest,
} from '@/services/connections/connection.service'
import {
  respondConnectionRequestSchema,
  sendConnectionRequestSchema,
  type RespondConnectionRequestInput,
  type SendConnectionRequestInput,
} from '@/services/connections/connection.schema'

export async function sendConnectionRequestAction(
  input: SendConnectionRequestInput,
): Promise<void> {
  const userId = await requireUser()

  const parsed = sendConnectionRequestSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'That connection request is not valid.',
    )
  }

  await sendConnectionRequest(userId, parsed.data)
}

export async function respondConnectionRequestAction(
  input: RespondConnectionRequestInput,
): Promise<void> {
  const userId = await requireUser()

  const parsed = respondConnectionRequestSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'That connection request is not valid.',
    )
  }

  await respondConnectionRequest(userId, parsed.data)
}
