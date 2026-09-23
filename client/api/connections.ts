import {
  respondConnectionRequestAction,
  sendConnectionRequestAction,
} from '@/app/actions/connections'
import {
  getConnectionFeedAction,
  type ConnectionFeedResult,
} from '@/app/actions/connection-feed'

export type ConnectionRequestStatus = 'pending' | 'accepted' | 'declined'

export interface ConnectionRequestInput {
  addresseeId: string
  message?: string
}

export interface ConnectionRespondInput {
  requestId: string
  decision: 'accept' | 'decline'
}

export async function sendConnectionRequest(
  input: ConnectionRequestInput,
): Promise<void> {
  await sendConnectionRequestAction({
    addresseeId: input.addresseeId,
    ...(input.message ? { message: input.message } : {}),
  })
}

export async function respondToConnectionRequest(
  input: ConnectionRespondInput,
): Promise<void> {
  await respondConnectionRequestAction({
    requestId: input.requestId,
    decision: input.decision,
  })
}

export async function fetchConnections(): Promise<ConnectionFeedResult> {
  return getConnectionFeedAction()
}
